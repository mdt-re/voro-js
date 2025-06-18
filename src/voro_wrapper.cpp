/**
 * An Emscripten binding to Javascript & WebAssembly for voro++:
 * - https://github.com/chr1shr/voro
 * - https://math.lbl.gov/voro++/
 * 
 * This implements a specific subset of the voro++ features and exposes them to Javascript.
*/


#include <emscripten/bind.h>
#include <vector>
#include <set>
#include <stdexcept>
#include "../voro++/src/voro++.hh"


/** \brief Helper structure to represent a 3d point for easy JavaScript interaction.
 */
struct Point3D
{
	double x;
	double y;
	double z;
};

/** \brief Helper structure to represent a Voronoi cell's vertices for JavaScript.
 */
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


/** \brief A C++ proxy class that wraps a JavaScript wall object.
 *
 * This class inherits from voro::wall, allowing it to be added to a Voro++
 * container. It holds a reference to a JavaScript object (via emscripten::val)
 * and forwards the essential wall method calls to it.
 */
class WallJS : public voro::wall 
{
public:
	// The constructor accepts the JavaScript object from the bindings.
	WallJS(emscripten::val js_obj) : wall(), wall_js_object(js_obj) {}
	
	// Explicitly define the virtual destructor for good practice.
	~WallJS() override = default;
	
	/** \brief Tests a point by calling the JavaScript implementation.
	 * \param[in] (x,y,z) the vector to test.
	 * \return true if the point is inside, false otherwise.
	 */
	bool point_inside(double x, double y, double z) override
	{
		// Forward the call to the 'point_inside' method on the JS object.
		return wall_js_object.call<bool>("point_inside", x, y, z);
	}
	
	/** \brief Cuts a voronoicell by the JavaScript wall. This overrides the
	 * pure virtual function in the base voro::wall class.
	 */
	bool cut_cell(voro::voronoicell &c, double x, double y, double z) override
	{
		return cut_cell_internal(c, x, y, z);
	}
	
	/** \brief Cuts a voronoicell_neighbor by the JavaScript wall. This also
	 * overrides a pure virtual function in the base voro::wall class.
	 */
	bool cut_cell(voro::voronoicell_neighbor &c, double x, double y, double z) override
	{
		return cut_cell_internal(c, x, y, z);
	}

private:
	// The JavaScript object that implements the wall logic.
	emscripten::val wall_js_object;
	
	/** \brief A helper function to contain the cutting logic, callable by both
	 * cut_cell implementations to avoid code duplication.
	 */
	template<class v_cell>
	bool cut_cell_internal(v_cell &c, double x, double y, double z)
	{
		// Forward the call to the 'cut_cell' method on the JS object.
		emscripten::val plane_params = wall_js_object.call<emscripten::val>("cut_cell", x, y, z);

		// Check if the JS function returned a valid object indicating a cut.
		if (!plane_params.isUndefined() && !plane_params.isNull() && plane_params["cut"].as<bool>())
		{
			// Cut the cell using the plane data returned from JavaScript.
			c.plane(
				plane_params["nx"].as<double>(),
				plane_params["ny"].as<double>(),
				plane_params["nz"].as<double>(),
				plane_params["d"].as<double>()
			);
			return true;
		}
		return false;
	}
};


// class for the Voronoi context in which all calculations take place
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
		}
		for (size_t i = 0; i < ids.size(); ++i)
			con.put(ids[i], x_coords[i], y_coords[i], z_coords[i]);
	}
	
	// adds a single plane wall to the container with normal vector (x, y, z) and displacement d
	void addWallPlane(double x, double y, double z, double d, int id=-99)
	{
		voro::wall_plane plane(x, y, z, d, id);
		con.add_wall(plane);
	}
	
	// adds a spherical wall to the container with center (x, y, z) and radius r
	void addWallSphere(double x, double y, double z, double r, int id=-99)
	{
		voro::wall_sphere sphere(x, y, z, r, id);
		con.add_wall(sphere);
	}
	
	// adds an open cylindrical wall to the container with axis point (ax, ay, az) axis vector (vx, vy, vz) and radius r
	void addWallCylinder(double ax, double ay, double az, double vx, double vy, double vz, double r, int id=-99)
	{
		voro::wall_cylinder cylinder(ax, ay, az, vx, vy, vz, r, id);
		con.add_wall(cylinder);
	}
	
	// adds a conal wall to the container with apex point (ax, ay, az) axis vector (vx, vy, vz) and angle a (in radians)
	void addWallCone(double ax, double ay, double az, double vx, double vy, double vz, double a, int id=-99)
	{
		voro::wall_cone cone(ax, ay, az, vx, vy, vz, a, id);
		con.add_wall(cone);
	}
	
	void addWallJS(emscripten::val js_wall)
	{
		// Create the cpp proxy wall from the given JS implementation. Create an
		// instance on the heap to control its lifetime and avoid null pointer exceptions.
		WallJS* cpp_wall_proxy = new WallJS(js_wall);
		// Add the proxy wall to the container. The voro++ container now owns this pointer and
        // is responsible for deleting it upon calling clear() or its own destructor.
		con.add_wall(*cpp_wall_proxy);
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
		voro::voronoicell cell;
		if (cla.start())
		{
			do
			{
				if (con.compute_cell(cell, cla))
				{
					// Get id and centroid of the cell.
					int id = cla.pid();
					double cx, cy, cz;
					cell.centroid(cx, cy, cz);
					// Add new relaxed point.
					Point3D point = {cx, cy, cz};
					relaxed_points[id] = point;
					// TODO: fix this potential out of bounds: devise a strategy that passes the ID as well.
				}
			}
			while (cla.inc());
		}
		return relaxed_points;
	}

    // Clears all particles from the container
	void clear()
	{
		con.clear();
	}

private:
	// container of voro++ library
	voro::container con;
	
	// extracts all cell details into a VoronoiCell struct instance
	void extract_cell(voro::voronoicell_neighbor& c, voro::c_loop_all& cla, VoronoiCell& cell)
	{
		// Get cell position by call by reference.
		cla.pos(cell.position.x, cell.position.y, cell.position.z);
		
		// Get id and volume.
		cell.id = cla.pid();
		cell.volume = c.volume();
		
		// Get cell vertices, these are updated by call by reference.
		std::vector<double> v;
		c.vertices(cell.position.x, cell.position.y, cell.position.z, v);
		// Then convert the vertices from [x1, y1, z1, ...] to vector<Point3D>.
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
		
		// Extract unique edges from the face data.
		std::set<std::vector<int>> unique_edges;
		for (const auto& face : cell.faces)
		{
			for (size_t j = 0; j < face.size(); ++j)
			{
				int v1 = face[j];
				int v2 = face[(j + 1) % face.size()];				
				// Sort to ensure uniqueness, e.g. (1, 2) is the same as (2, 1).
				if (v1 > v2)
					std::swap(v1, v2);
				unique_edges.insert({v1, v2});
			}
		}
		// Convert the unique edges set back to a vector<vector<int>>.
		cell.edges.assign(unique_edges.begin(), unique_edges.end());
		
		// Get cell neighbors, these are updated by call by reference.
		c.neighbors(cell.neighbors);
		return;
	}
};

/** \brief A C++ class that binds a Voronoi cell to Javascript.
 *
 * This class inherits from voro::voronoicell and exposes the relevant functions
 * to JavaScript.
 */
class VoronoiCell3D
{
public:
	// Use the basic cell constructor, which allocates memory automatically.
	VoronoiCell3D() {}
	
	/** \brief Initializes cell as a rectangular box.
	 *  Initializes the Voronoi cell to be rectangular box with the
	 * given dimensions.
	 * \param[in] (xmin,xmax) the minimum and maximum x coordinates.
	 * \param[in] (ymin,ymax) the minimum and maximum y coordinates.
	 * \param[in] (zmin,zmax) the minimum and maximum z coordinates.
	 */
	void initBox(double xmin, double xmax, double ymin, double ymax, double zmin, double zmax)
	{
		cell.init(xmin, xmax, ymin, ymax, zmin, zmax);
	}
	
	/** \brief Cuts a Voronoi cell by a plane.
	 * Cuts a Voronoi cell using by the plane corresponding to the
	 * perpendicular bisector of a particle.
	 * \param[in] (x,y,z) the position of the particle.
	 * \param[in] rsq the modulus squared of the vector (optional).
	 * \return False if the plane cut deleted the cell entirely, true otherwise.
	 */
	bool cutPlane(double x, double y, double z)
	{
		return cell.plane(x, y, z);
	}
	//~ bool cutPlane(double x, double y, double z, double rsq)
	//~ {
		//~ return cell.plane(x, y, z, rsq);
	//~ }
	
	/** \brief Gets the Voronoi cell.
	 * Returns the Voronoi cell prepared for Javascript interpretation.
	 * \return The Voronoi cell in VoronoiCell format.
	 */
	VoronoiCell getCell()
	{
		VoronoiCell voronoi_cell;
		// Assume cell position equals (0, 0, 0).
		voronoi_cell.position = {0, 0, 0};
		
		voronoi_cell.volume = cell.volume();
		
		// Get cell vertices, these are updated by call by reference.
		std::vector<double> v;
		cell.vertices(voronoi_cell.position.x, voronoi_cell.position.y, voronoi_cell.position.z, v);
		// Then convert the vertices from [x1, y1, z1, ...] to vector<Point3D>.
		for (size_t i = 0; i < v.size(); i += 3)
			voronoi_cell.vertices.push_back({v[i], v[i+1], v[i+2]});
		
		return voronoi_cell;
	}

private:
	// The cell is stored in this binding class.
	voro::voronoicell cell;
};


/** \brief Emscripten bindings.
 *
 * This binds all C++ code to Javascript.
 */
EMSCRIPTEN_BINDINGS(voro_module_3d)
{
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
		.function("addWallPlane", &VoronoiContext3D::addWallPlane)
		.function("addWallSphere", &VoronoiContext3D::addWallSphere)
		.function("addWallCylinder", &VoronoiContext3D::addWallCylinder)
		.function("addWallCone", &VoronoiContext3D::addWallCone)
		.function("addWallJS", &VoronoiContext3D::addWallJS)
		.function("getAllCells", &VoronoiContext3D::getAllCells)
		.function("getCellById", &VoronoiContext3D::getCellById)
		.function("relaxVoronoi", &VoronoiContext3D::relaxVoronoi)
		.function("clear", &VoronoiContext3D::clear);
		
	emscripten::class_<VoronoiCell3D>("VoronoiCell3D")
		.constructor<>()
		.function("initBox", &VoronoiCell3D::initBox)
		.function("cutPlane", &VoronoiCell3D::cutPlane)
		.function("getCell", &VoronoiCell3D::getCell);
}
