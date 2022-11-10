import CellList from "./celllist"
import NeighborList from "./neighborlist"

interface LennardJonesProps {
    epsilon: number
    sigma: number
    rCut: number
}

export default class LennardJones {
    epsilon: number
    sigma: number
    rCut: number
    cellList?: CellList
    neighborList?: NeighborList
    
    constructor({epsilon, sigma, rCut}: LennardJonesProps) {
        this.epsilon = epsilon
        this.sigma = sigma
        this.rCut = rCut
    }
    
    calculateAll(numParticles: number, systemSize: number, positions: Float32Array, forces: Float32Array) {
        const sigma6 = Math.pow(this.sigma, 6)
        const epsilon24 = 24 * this.epsilon
        // Clear forces
        forces.fill(0)
        
        for (let particleIndex1 = 0; particleIndex1 < numParticles; particleIndex1++) {
            for (let particleIndex2 = 0; particleIndex2 < numParticles; particleIndex2++) {
                if (particleIndex1 == particleIndex2) {
                    continue
                }
                let deltaX = positions[3 * particleIndex1 + 0] - positions[3 * particleIndex2 + 0]
                let deltaY = positions[3 * particleIndex1 + 1] - positions[3 * particleIndex2 + 1]
                let deltaZ = positions[3 * particleIndex1 + 2] - positions[3 * particleIndex2 + 2]
                
                // Apply periodic boundary conditions
                if (deltaX > 0.5*systemSize) {
                    deltaX -= systemSize
                } else if (deltaX < -0.5*systemSize) {
                    deltaX += systemSize
                }
                
                if (deltaY > 0.5*systemSize) {
                    deltaY -= systemSize
                } else if (deltaY < -0.5*systemSize) {
                    deltaY += systemSize
                }
                
                if (deltaZ > 0.5*systemSize) {
                    deltaZ -= systemSize
                } else if (deltaZ < -0.5*systemSize) {
                    deltaZ += systemSize
                }
                
                const deltaR2 = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
                if (deltaR2 < this.rCut*this.rCut) {
                    const r = Math.sqrt(deltaR2)
                    const oneOverDr2 = 1.0/deltaR2
                    const oneOverDr6 = oneOverDr2*oneOverDr2*oneOverDr2
                    const force = epsilon24*sigma6*oneOverDr6*(2*sigma6*oneOverDr6 - 1)*oneOverDr2
                    
                    forces[3 * particleIndex1 + 0] += force * deltaX
                    forces[3 * particleIndex1 + 1] += force * deltaY
                    forces[3 * particleIndex1 + 2] += force * deltaZ
                }
            }
        }
    }
    
    calculateCells(numParticles: number, systemSize: number, positions: Float32Array, forces: Float32Array) {
        if (this.cellList == null) {
            this.cellList = new CellList()
        }
        this.cellList.build(positions, numParticles, systemSize, this.rCut)
        const sigma6 = Math.pow(this.sigma, 6)
        const epsilon24 = 24 * this.epsilon
        // Clear forces
        forces.fill(0)
        
        for (let particleIndex1 = 0; particleIndex1 < numParticles; particleIndex1++) {
            const cx = Math.floor(positions[3 * particleIndex1 + 0]/systemSize*this.cellList.numberOfCells)
            const cy = Math.floor(positions[3 * particleIndex1 + 1]/systemSize*this.cellList.numberOfCells)
            const cz = Math.floor(positions[3 * particleIndex1 + 2]/systemSize*this.cellList.numberOfCells)
            
            for(let dx=-1; dx<=1; dx++) {
                for(let dy=-1; dy<=1; dy++) {
                    for(let dz=-1; dz<=1; dz++) {
                        const cellIndex = this.cellList.getCellIndexPeriodic(cx + dx, cy + dy, cz + dz)
                        for (let i = 0; i < this.cellList.cells[cellIndex].length; i++) {
                            const particleIndex2 = this.cellList.cells[cellIndex][i]
                            if (particleIndex1 === particleIndex2) {
                                continue
                            }
                            
                            let deltaX = positions[3 * particleIndex1 + 0] - positions[3 * particleIndex2 + 0]
                            let deltaY = positions[3 * particleIndex1 + 1] - positions[3 * particleIndex2 + 1]
                            let deltaZ = positions[3 * particleIndex1 + 2] - positions[3 * particleIndex2 + 2]
                            
                            // Apply periodic boundary conditions
                            if (deltaX > 0.5*systemSize) {
                                deltaX -= systemSize
                            } else if (deltaX < -0.5*systemSize) {
                                deltaX += systemSize
                            }
                            
                            if (deltaY > 0.5*systemSize) {
                                deltaY -= systemSize
                            } else if (deltaY < -0.5*systemSize) {
                                deltaY += systemSize
                            }
                            
                            if (deltaZ > 0.5*systemSize) {
                                deltaZ -= systemSize
                            } else if (deltaZ < -0.5*systemSize) {
                                deltaZ += systemSize
                            }
                            
                            const deltaR2 = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
                            if (deltaR2 < this.rCut*this.rCut) {
                                // const r = Math.sqrt(deltaR2)
                                const oneOverDr2 = 1.0/deltaR2
                                const oneOverDr6 = oneOverDr2*oneOverDr2*oneOverDr2
                                const force = epsilon24*sigma6*oneOverDr6*(2*sigma6*oneOverDr6 - 1)*oneOverDr2
                                // const force = epsilon24 / deltaR2 * (2 * Math.pow(sigma/r, 12) - Math.pow(sigma/r, 6))
                                
                                forces[3 * particleIndex1 + 0] += force * deltaX
                                forces[3 * particleIndex1 + 1] += force * deltaY
                                forces[3 * particleIndex1 + 2] += force * deltaZ
                            }
                        }
                    }
                }
            }
        }
    }

    calculateNeighborList(numParticles: number, systemSize: number, positions: Float32Array, forces: Float32Array) {
        if (this.cellList == null) {
            this.cellList = new CellList()
        }
        if (this.neighborList == null) {
            this.neighborList = new NeighborList()
        }
        const rShell = 0.3
        this.cellList.build(positions, numParticles, systemSize, this.rCut + rShell)
        this.neighborList.build(numParticles, systemSize, this.rCut + rShell, this.cellList, positions)

        const sigma6 = Math.pow(this.sigma, 6)
        const epsilon24 = 24 * this.epsilon
        // Clear forces
        forces.fill(0)
        
        for (let particleIndex1 = 0; particleIndex1 < numParticles; particleIndex1++) {
          const atomNeighbors = this.neighborList.neighbors[particleIndex1]
          for (let j = 0; j < this.neighborList.neighborCount[particleIndex1]; j++) {
            const particleIndex2 = atomNeighbors[j]

            let deltaX = positions[3 * particleIndex1 + 0] - positions[3 * particleIndex2 + 0]
            let deltaY = positions[3 * particleIndex1 + 1] - positions[3 * particleIndex2 + 1]
            let deltaZ = positions[3 * particleIndex1 + 2] - positions[3 * particleIndex2 + 2]
            
            // Apply periodic boundary conditions
            if (deltaX > 0.5*systemSize) {
              deltaX -= systemSize
            } else if (deltaX < -0.5*systemSize) {
              deltaX += systemSize
            }

            if (deltaY > 0.5*systemSize) {
              deltaY -= systemSize
            } else if (deltaY < -0.5*systemSize) {
              deltaY += systemSize
            }

            if (deltaZ > 0.5*systemSize) {
              deltaZ -= systemSize
            } else if (deltaZ < -0.5*systemSize) {
              deltaZ += systemSize
            }

            const deltaR2 = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ
            if (deltaR2 < this.rCut*this.rCut) {
              const r = Math.sqrt(deltaR2)
              const oneOverDr2 = 1.0/deltaR2
              const oneOverDr6 = oneOverDr2*oneOverDr2*oneOverDr2
              const force = epsilon24*sigma6*oneOverDr6*(2*sigma6*oneOverDr6 - 1)*oneOverDr2
              // const force = epsilon24 / deltaR2 * (2 * Math.pow(sigma/r, 12) - Math.pow(sigma/r, 6))
              
              forces[3 * particleIndex1 + 0] += force * deltaX
              forces[3 * particleIndex1 + 1] += force * deltaY
              forces[3 * particleIndex1 + 2] += force * deltaZ
            }
          }
        }
    }
}