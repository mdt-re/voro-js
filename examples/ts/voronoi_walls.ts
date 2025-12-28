/**
 * @class VoronoiWall
 * Template class for specific wall implementations.
 */
export abstract class VoronoiWall
{
	/**
	 * Construction of the wall should take its defining elements as parameters.
	 * 
	 */
	constructor()
	{
		console.warn(this, "constructor() must be overloaded");
	}
	/**
	 * Should return whether the point (x, y, z) is inside the geometry of the wall.
	 */
	point_inside(x: number, y: number, z: number)
	{
		console.warn(this, "point_inside(x, y, z) must be overloaded");
	}
	/**
	 * Should return how to cut the cell at (x, y, z).
	 */
	cut_cell(x: number, y: number, z: number)
	{
		console.warn(this, "cut_cell(x, y, z) must be overloaded");
	}
}

/**
 * @class VoronoiWallTorus
 * Torus with major radius ra and minor radius rb.
 */
class VoronoiWallTorus
{
	ra: number;
	rb: number;

	constructor(ra: number, rb: number)
	{
		this.ra = ra;
		this.rb = rb;
	}
	
	point_inside(x: number, y: number, z: number)
	{
		const t = Math.sqrt(x*x + y*y) - this.ra;
		return t*t + z*z < this.rb*this.rb;
	}
	
	cut_cell(x: number, y: number, z: number)
	{
		const orad = Math.sqrt(x*x + y*y);
		let odis = orad - this.ra;
		let ot = odis*odis + z*z;
		
		if (ot > 0.01*this.rb*this.rb)
		{
			ot = 2 * this.rb / Math.sqrt(ot) - 2;
			z *= ot;
			odis *= ot / orad;
			x *= odis;
			y *= odis;
			return { cut: true, nx: x, ny: y, nz: z, d: 0 };
		}
		return { cut: false };
	}
}

/**
 * @class VoronoiWallLemniscate
 * Lemniscate of Bernoulli with half-width ra and tube radius rt.
 */
class VoronoiWallLemniscate
{
	ra: number;
	rt: number;
	steps: number;

	constructor(ra: number, rt: number, steps: number)
	{
		this.ra = ra;
		this.rt = rt;
		this.steps = steps;
	}
	
	point_inside(x: number, y: number, z: number)
	{
		const closest_point = this.find_minimum_distance(x, y);
		return closest_point.dist_sq + z*z < this.rt*this.rt;
	}
	
	cut_cell(x: number, y: number, z: number)
	{
		const closest_point = this.find_minimum_distance(x, y);
		const dist_sq = closest_point.dist_sq;
		const r_sq = dist_sq + z*z;
		
		if (r_sq > 0.01 * this.rt*this.rt)
		{
			const cx = closest_point.cx;
			const cy = closest_point.cy;
			const r = Math.sqrt(r_sq);
			const nx = (x - cx) / r;
			const ny = (y - cy) / r;
			const nz = 2 * z * (this.rt / r - 1);
			
			//const px_wall = cx + this.rt * nx;
			//const py_wall = cy + this.rt * ny;
			//const pz_wall = this.rt * nz;
			
			//const d = nx * px_wall + ny * py_wall + nz * pz_wall;
			
			return { cut: true, nx: x, ny: y, nz: z, d: 0 };
		}
		return { cut: false };
	}
	
	/**
	 * Finds the minium distance of a point [x, y] to the lemniscate and returns the distance and that point as
	 * an object { dist_sq, cx, cy }.
	 */
	find_minimum_distance(x: number, y: number)
	{
		let min_dist_sq = 1e100;
		let closest_x = 0;
		let closest_y = 0;

		for (let i = 0; i < this.steps; i++)
		{
			const t = (2.0 * Math.PI * i) / this.steps;
			const cur_x = this.ra * Math.cos(t) / (1 + Math.sin(t)**2);
			const cur_y = this.ra * Math.sin(t) * Math.cos(t) / (1 + Math.sin(t)**2);

			const dx = x - cur_x;
			const dy = y - cur_y;
			const dist_sq = dx * dx + dy * dy;

			if (dist_sq < min_dist_sq)
			{
				min_dist_sq = dist_sq;
				closest_x = cur_x;
				closest_y = cur_y;
			}
		}
		return { dist_sq: min_dist_sq, cx: closest_x, cy: closest_y };
	}
}

/**
 * @class VoronoiWallCylinder
 * Cylinder with radius r and height h.
 */
class VoronoiWallCylinder
{
	r: number;
	h: number;

	constructor(r: number, h: number)
	{
		this.r = r;
		this.h = h;
	}
	
	point_inside(x: number, y: number, z: number)
	{
		return x*x + y*y < this.r*this.r && z > -this.h/2 && z < this.h/2;
	}
	
	cut_cell(x: number, y: number, z: number)
	{
		let dq = x*x + y*y;
		if (dq > 0.01)
		{
			dq = 2 * (Math.sqrt(dq) * this.r - dq);
			return { cut: true, nx: x, ny: y, nz: z, d: dq };
		}
	}
}


export { VoronoiWallTorus, VoronoiWallLemniscate, VoronoiWallCylinder };
