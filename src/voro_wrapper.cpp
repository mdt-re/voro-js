/*
 * An Emscripten binding to Javascript & WebAssembly for voro++:
 *   https://github.com/chr1shr/voro
 *   https://math.lbl.gov/voro++/
 * 
 * This implements a specific subset of the voro++ features and exposes them to Javascript.
*/


#include <emscripten/bind.h>
#include <vector>
#include <set>
#include <stdexcept>
#include "../voro++/src/voro++.hh"


// helper structure to represent a 3d point for easy js interaction
struct Point3D
{
	double x;
	double y;
	double z;
};

// helper structure to represent a Voronoi cell's vertices for js
struct VoronoiCell
{
	int id;
	Point3D position;
	double volume;
	std::vector<Point3D> vertices;
	std::vector<std::vector<int>> edges;
	std::vector<std::vector<int>> faces;
	std::vector<int> neighbors;
};

class VoronoiContext3D
{
public:
    // Constructor: initializes a 3D Voro++ container
    // Parameters define the bounding box and periodicity
    VoronoiContext3D(double minX, double maxX, double minY, double maxY, double minZ, double maxZ, bool periodicX, bool periodicY, bool periodicZ)
        // Initialize with a coarse 1x1x1 grid; Voro++ will refine it as needed.
        : con(minX, maxX, minY, maxY, minZ, maxZ, 6, 6, 6, periodicX, periodicY, periodicZ, 8) {}

	// adds a single 3d point to the container
	void addPoint(int id, double x, double y, double z)
	{
		con.put(id, x, y, z);
	}

	// adds multiple 3d points to the container
	void addPoints(const std::vector<int>& ids, const std::vector<double>& x_coords, const std::vector<double>& y_coords, const std::vector<double>& z_coords)
	{
		if (ids.size() != x_coords.size() || ids.size() != y_coords.size() || ids.size() != z_coords.size()) {
			throw std::runtime_error(std::string("addPoints failed because of mismatch in ids and xyz_coords sizes"));
			return;
		}
		for (size_t i = 0; i < ids.size(); ++i)
			con.put(ids[i], x_coords[i], y_coords[i], z_coords[i]);
	}

	// computes and returns all Voronoi cells in the container
	std::vector<VoronoiCell> getAllCells()
	{
		// init js cells, loop over all cells using the voro++ iterator
		std::vector<VoronoiCell> cells;
		voro::c_loop_all cla(con);
		voro::voronoicell_neighbor c;
		
		// check if there are any cells to loop over
		if (cla.start())
		{
			do {
				// compute the cell for the current particle
				if (con.compute_cell(c, cla))
				{
					// create the cell in js and extract all properties from voro++
					VoronoiCell cell;
					extract_cell(c, cla, cell);
					
					// add this cell to the vector of cells
					cells.push_back(cell);
					
					//~ // get cell position by call by reference
					//~ cla.pos(current_cell.position.x, current_cell.position.y, current_cell.position.z);
					
					//~ // get id and volume
					//~ current_cell.id = cla.pid();
					//~ current_cell.volume = c.volume();
					
					//~ // get cell vertices, these are updated by call by refernce
					//~ std::vector<double> v;
					//~ c.vertices(current_cell.position.x, current_cell.position.y, current_cell.position.z, v);
					//~ // then convert the vertices from [x1, y1, z1, ...] to ????????????
					//~ for (size_t i = 0; i < v.size(); i += 3)
						//~ current_cell.vertices.push_back({v[i], v[i+1], v[i+2]});
						
					//~ // get cell faces and orders, these are updated by call by reference
					//~ std::vector<int> face_vertices, face_orders;
					//~ c.face_vertices(face_vertices);
					//~ c.face_orders(face_orders);
					
					//~ // then convert these two vectors to a vector of vector of ints where
					//~ // each vector contains the vertex numbers corresponding to a face
					//~ // the order contains the number of vertices for the indexed face
					//~ int fv_offset = 0;
					//~ for (int fv_cnt : face_orders)
					//~ {
						//~ std::vector<int> current_face;
						//~ current_face.reserve(fv_cnt);
						//~ for (int j = 0; j < fv_cnt; ++j)
							//~ current_face.push_back(face_vertices[fv_offset + j]);
						//~ current_cell.faces.push_back(current_face);
						//~ fv_offset += fv_cnt;
					//~ }
					
					//~ // also extract the edges from these
					//~ std::set<std::vector<int>> unique_edges;
					//~ for (const auto& face : current_cell.faces) {
						//~ for (size_t j = 0; j < face.size(); ++j) {
							//~ int v1 = face[j];
							//~ int v2 = face[(j + 1) % face.size()];
							//~ if (v1 > v2) std::swap(v1, v2);
							//~ unique_edges.insert({v1, v2});
						//~ }
					//~ }
					//~ // the set removes the duplicates, now convert to vector of vector of ints
					//~ for (const auto& edge : unique_edges)
						//~ current_cell.edges.push_back(edge);
					
					//~ // get cell neighbors, these are updated by call by reference
					//~ c.neighbors(current_cell.neighbors);
					
				}
			}
			while (cla.inc());
		}
		return cells;
	}
	
	// computes and returns a specific Voronoi cell by its ID
	VoronoiCell getCellById(int id)
	{
		VoronoiCell cell;
		voro::c_loop_all cla(con);
		voro::voronoicell_neighbor c;
		
		// check if there are any cells to loop over
		if (cla.start())
		{
			do {
				// only do something if id matches
				if (cla.pid() == id)
				{
					// compute the cell for the current particle
					if (con.compute_cell(c, cla))
					{
						extract_cell(c, cla, cell);
						return cell;
					}
				}
			}
			while (cla.inc());
		}
		// handle case where cell ID is not found by just returning empty cell
		return cell;
	}
	
	// returns a set of points that correspond to a single step in Voronoi relaxation
	// these are the centroids of the current cells and can serve as input for the algorithm
	std::vector<Point3D> relaxVoronoi()
	{
		std::vector<Point3D> relaxed_points(con.total_particles());
		
		// loop over all cells
		voro::c_loop_all cla(con);
		voro::voronoicell c;
		if (cla.start())
		{
			do
			{
				if (con.compute_cell(c, cla))
				{
					// get id and centroid of cell
					int id = cla.pid();
					double cx, cy, cz;
					c.centroid(cx, cy, cz);
					
					// add new relaxed point
					Point3D point = {cx, cy, cz};
					relaxed_points[id] = point;
				}
			}
			while (cla.inc());
		}
		return relaxed_points;
	}

    // Clears all particles from the container
	void clear() {
		con.clear();
	}

private:
	// container of voro++ library
	voro::container con;
	
	// extracts all cell details into a VoronoiCell struct instance
	void extract_cell(voro::voronoicell_neighbor& c, voro::c_loop_all& cla, VoronoiCell& cell)
	{
		// get cell position by call by reference
		cla.pos(cell.position.x, cell.position.y, cell.position.z);
		
		// get id and volume
		cell.id = cla.pid();
		cell.volume = c.volume();
		
		// get cell vertices, these are updated by call by refernce
		std::vector<double> v;
		c.vertices(cell.position.x, cell.position.y, cell.position.z, v);
		// then convert the vertices from [x1, y1, z1, ...] to ????????????
		for (size_t i = 0; i < v.size(); i += 3)
			cell.vertices.push_back({v[i], v[i+1], v[i+2]});
			
		// get cell faces and orders, these are updated by call by reference
		std::vector<int> face_vertices, face_orders;
		c.face_vertices(face_vertices);
		c.face_orders(face_orders);
		
		// then convert these two vectors to a vector of vector of ints where
		// each vector contains the vertex numbers corresponding to a face
		// the order contains the number of vertices for the indexed face
		int fv_offset = 0;
		for (int fv_cnt : face_orders)
		{
			std::vector<int> current_face;
			current_face.reserve(fv_cnt);
			for (int j = 0; j < fv_cnt; ++j)
				current_face.push_back(face_vertices[fv_offset + j]);
			cell.faces.push_back(current_face);
			fv_offset += fv_cnt;
		}
		
		// also extract the edges from these
		std::set<std::vector<int>> unique_edges;
		for (const auto& face : cell.faces) {
			for (size_t j = 0; j < face.size(); ++j) {
				int v1 = face[j];
				int v2 = face[(j + 1) % face.size()];
				if (v1 > v2) std::swap(v1, v2);
				unique_edges.insert({v1, v2});
			}
		}
		// the set removes the duplicates, now convert to vector of vector of ints
		for (const auto& edge : unique_edges)
			cell.edges.push_back(edge);
		
		// get cell neighbors, these are updated by call by reference
		c.neighbors(cell.neighbors);
		return;
	}
};


// binding code using embind
EMSCRIPTEN_BINDINGS(voro_module_3d) {
	emscripten::value_object<Point3D>("Point3D")
		.field("x", &Point3D::x)
		.field("y", &Point3D::y)
		.field("z", &Point3D::z);

	emscripten::value_object<VoronoiCell>("VoronoiCell")
		.field("id", &VoronoiCell::id)
		.field("position", &VoronoiCell::position)
		.field("volume", &VoronoiCell::volume)
		.field("vertices", &VoronoiCell::vertices)
		.field("edges", &VoronoiCell::edges)
		.field("faces", &VoronoiCell::faces)
		.field("neighbors", &VoronoiCell::neighbors);

	emscripten::register_vector<Point3D>("VectorPoint3D");
	emscripten::register_vector<VoronoiCell>("VectorVoronoiCell");
	emscripten::register_vector<int>("VectorInt");
	emscripten::register_vector<double>("VectorDouble");
	emscripten::register_vector<std::vector<int>>("VectorVectorInt");

	emscripten::class_<VoronoiContext3D>("VoronoiContext3D")
		.constructor<double, double, double, double, double, double, bool, bool, bool>()
		.function("addPoint", &VoronoiContext3D::addPoint)
		.function("addPoints", &VoronoiContext3D::addPoints)
		.function("getAllCells", &VoronoiContext3D::getAllCells)
		.function("getCellById", &VoronoiContext3D::getCellById)
		.function("relaxVoronoi", &VoronoiContext3D::relaxVoronoi)
		.function("clear", &VoronoiContext3D::clear);
}
