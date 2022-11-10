import {Particles} from 'omovi'

interface SystemProps {
    capacity: number
}

export default class System {
    particles: Particles
    velocities: Float32Array
    forces: Float32Array
    capacity: number
    size: number

    constructor({capacity}: SystemProps) {
        this.particles = new Particles(capacity)
        this.velocities = new Float32Array(3*capacity)
        this.forces = new Float32Array(3*capacity)

        this.size = 0
        this.capacity = capacity
    }

    createFCC(numCells: number, latticeConstant: number, offset: number = 0) {
        const capacity = numCells*numCells*numCells*4
        if (capacity > this.capacity) {
            console.error("Creating FCC with more particles than what is allocated.")
            return
        }

        const xCell = [0, 0.5, 0.5, 0]
        const yCell = [0, 0.5, 0, 0.5]
        const zCell = [0, 0, 0.5, 0.5]
    
        let count = 0
        for (let i = 0; i < numCells; i++) {
          for (let j = 0; j < numCells; j++) {
            for (let k = 0; k < numCells; k++) {
              for(let l=0; l<4; l++) {
                this.particles.positions[3 * count + 0] = (i+xCell[l])*latticeConstant + offset
                this.particles.positions[3 * count + 1] = (j+yCell[l])*latticeConstant + offset
                this.particles.positions[3 * count + 2] = (k+zCell[l])*latticeConstant + offset
                count += 1
              }
            }
          }
        }
        this.size = latticeConstant * numCells
        this.particles.count = count
      }
}