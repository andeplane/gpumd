import CellList from "./celllist"
import NeighborList from "./neighborlist"
import { GPU } from 'gpu.js';
const gpu = new GPU();

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
  time: number
  kernel?: any
  
  constructor({epsilon, sigma, rCut}: LennardJonesProps) {
    this.epsilon = epsilon
    this.sigma = sigma
    this.rCut = rCut
    this.time = 0
  }
  
  calculateAll(numParticles: number, systemSize: number, positions: Float32Array, forces: Float32Array) {
    const start = performance.now()
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
    const end = performance.now()
    this.time += end-start
  }
  
  calculateCells(numParticles: number, systemSize: number, positions: Float32Array, forces: Float32Array) {
    if (this.cellList == null) {
      this.cellList = new CellList()
    }
    this.cellList.build(positions, numParticles, systemSize, this.rCut)
    const start = performance.now()
    
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
            for (let i = 0; i < this.cellList.cellCount[cellIndex]; i++) {
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
                const r = Math.sqrt(deltaR2)
                const oneOverDr2 = 1.0/deltaR2
                const oneOverDr6 = oneOverDr2*oneOverDr2*oneOverDr2
                const force = epsilon24*sigma6*oneOverDr6*(2*sigma6*oneOverDr6 - 1)*oneOverDr2
                // const force = epsilon24 / deltaR2 * (2 * Math.pow(this.sigma/r, 12) - Math.pow(this.sigma/r, 6))
                
                forces[3 * particleIndex1 + 0] += force * deltaX
                forces[3 * particleIndex1 + 1] += force * deltaY
                forces[3 * particleIndex1 + 2] += force * deltaZ
              }
            }
          }
        }
      }
    }
    const end = performance.now()
    this.time += end-start
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
    const start = performance.now()
    
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
    const end = performance.now()
    this.time += end-start
  }
  
  calculateGPU(numParticles: number, systemSize: number, positions: Float32Array, forces: Float32Array) {
    if (this.cellList == null) {
      this.cellList = new CellList()
    }
    this.cellList.build(positions, numParticles, systemSize, this.rCut)
    
    const sigma6 = Math.pow(this.sigma, 6)
    const epsilon24 = 24 * this.epsilon
    // Clear forces
    forces.fill(0)
    
    if (this.kernel == null) {
      this.kernel = gpu.createKernel(function(positions: Float32Array, cells: Float32Array[], cellCount: Float32Array) { 
        let epsilon24: number = 24
        let sigma6: number = Math.pow(3.405, 6)
        
        let f = 0
        
        function getCellIndex(cx: number, cy: number, cz: number) {
          //@ts-ignore
          return cx*this.constants.numberOfCells*this.constants.numberOfCells + cy*this.constants.numberOfCells + cz
        }
        
        function getCellIndexPeriodic(cx: number, cy: number, cz: number) {
          //@ts-ignore
          return ( (cx+this.constants.numberOfCells) % this.constants.numberOfCells)*this.constants.numberOfCells*this.constants.numberOfCells + ( (cy+this.constants.numberOfCells) % this.constants.numberOfCells)*this.constants.numberOfCells + ( (cz+this.constants.numberOfCells) % this.constants.numberOfCells)
        }
        const particleIndex1 = this.thread.y
        
        //@ts-ignore
        const cx = Math.floor(positions[3 * particleIndex1 + 0]/this.constants.systemSize*this.constants.numberOfCells)
        //@ts-ignore
        const cy = Math.floor(positions[3 * particleIndex1 + 1]/this.constants.systemSize*this.constants.numberOfCells)
        //@ts-ignore
        const cz = Math.floor(positions[3 * particleIndex1 + 2]/this.constants.systemSize*this.constants.numberOfCells)
        for(let dx=-1; dx<=1; dx++) {
          for(let dy=-1; dy<=1; dy++) {
            for(let dz=-1; dz<=1; dz++) {
              const cellIndex = getCellIndexPeriodic(cx + dx, cy + dy, cz + dz)
              for (let i = 0; i < cellCount[cellIndex]; i++) {
                const particleIndex2 = cells[cellIndex][i]
                if (particleIndex1 === particleIndex2) {
                  continue
                }
                
                const delta = [
                  positions[3 * this.thread.y + 0] - positions[3 * particleIndex2 + 0],
                  positions[3 * this.thread.y + 1] - positions[3 * particleIndex2 + 1],
                  positions[3 * this.thread.y + 2] - positions[3 * particleIndex2 + 2]
                ]
                
                for (let j = 0; j < 3; j++) {
                  //@ts-ignore
                  if (delta[j] < -0.5 * this.constants.systemSize) {
                    //@ts-ignore
                    delta[j] += this.constants.systemSize
                    //@ts-ignore
                  } else if (delta[j] > 0.5 * this.constants.systemSize) {
                    //@ts-ignore
                    delta[j] -= this.constants.systemSize
                  }
                }
                
                const dr2 = delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2]
                const oneOverDr2 = 1.0/dr2
                const oneOverDr6 = oneOverDr2*oneOverDr2*oneOverDr2
                const force = epsilon24*sigma6*oneOverDr6*(2*sigma6*oneOverDr6 - 1)*oneOverDr2
                f += force * delta[this.thread.x]
              }
            }
          }
        }
        
        return f
      }).setOutput([3,numParticles]).setConstants({
        systemSize,
        numberOfCells: this.cellList.numberOfCells,
      })
    }
    const start1 = performance.now()
    const f = this.kernel(positions, this.cellList.cells, this.cellList.cellCount)
    const end1 = performance.now()
    const start2 = performance.now()
    console.log(f)
    this.calculateCells(numParticles, systemSize, positions, forces)
    const end2 = performance.now()
    console.log(forces)
    console.log("Times: ", end1-start1, end2-start2)
  }
  
  
}