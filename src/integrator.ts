import LennardJones from "./force"
import System from "./system"

interface IntegratorProps {
    dt: number
    potential: LennardJones
}

export default class Integrator {
    dt: number
    timesteps: number
    mass: number
    potential: LennardJones
    
    constructor({dt, potential}: IntegratorProps) {
        this.dt = dt
        this.timesteps = 0
        this.mass = 1
        this.potential = potential
    }
    
    halfKick(numParticles: number, positions: Float32Array, velocities: Float32Array, forces: Float32Array) {
        for (let i = 0; i < numParticles; i++) {
            velocities[3 * i + 0] += forces[3 * i + 0] / this.mass * 0.5 * this.dt
            velocities[3 * i + 1] += forces[3 * i + 1] / this.mass * 0.5 * this.dt
            velocities[3 * i + 2] += forces[3 * i + 2] / this.mass * 0.5 * this.dt
        }
    }
    
    move(numParticles: number, systemSize: number, positions: Float32Array, velocities: Float32Array) {
        for (let i = 0; i < numParticles; i++) {
            positions[3 * i + 0] += velocities[3 * i + 0] * this.dt
            positions[3 * i + 1] += velocities[3 * i + 1] * this.dt
            positions[3 * i + 2] += velocities[3 * i + 2] * this.dt
            
            // Apply PBC
            if (positions[3 * i + 0] > systemSize) {
                positions[3 * i + 0] -= systemSize
            } else if (positions[3 * i + 0] < 0) {
                positions[3 * i + 0] += systemSize
            }
            
            if (positions[3 * i + 1] > systemSize) {
                positions[3 * i + 1] -= systemSize
            } else if (positions[3 * i + 1] < 0) {
                positions[3 * i + 1] += systemSize
            }
            if (positions[3 * i + 2] > systemSize) {
                positions[3 * i + 2] -= systemSize
            } else if (positions[3 * i + 2] < 0) {
                positions[3 * i + 2] += systemSize
            }
        }
    }
    
    integrate(system: System) {
        this.halfKick(system.particles.count, system.particles.positions, system.velocities, system.forces)
        this.move(system.particles.count, system.size, system.particles.positions, system.velocities)
        this.potential.calculateAll(system.particles.count, system.size, system.particles.positions, system.forces)
        this.halfKick(system.particles.count, system.particles.positions, system.velocities, system.forces)
    }
}