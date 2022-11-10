import CellList from "./celllist"

export default class NeighborList {
  neighbors: Int32Array[]
  neighborCount: Int32Array
  positionsAtLastBuild: Float32Array
  time: number

  constructor() {
    this.neighbors = []
    this.neighborCount = new Int32Array()
    this.positionsAtLastBuild = new Float32Array()
    this.time = 0
  }

  build = (numParticles: number, systemSize: number, rCut: number, cellList: CellList, positions: Float32Array) => {
    const start = performance.now()
    if (numParticles > this.neighborCount.length) {
      this.neighborCount = new Int32Array(numParticles)
      for (let i = 0; i < numParticles; i++) {
        this.neighbors[i] = new Int32Array(1000) // 1000 neighbors per atom
      }
    }
    if (this.positionsAtLastBuild.length !== positions.length) {
      this.positionsAtLastBuild = new Float32Array(positions.length)
      this.positionsAtLastBuild.set(positions)
    }
    this.neighborCount.fill(0)
    let pairs = 0

    const existsMap: {[key: string]: boolean} = {}
    for (let particle1Index = 0; particle1Index < numParticles; particle1Index++) {
      const cx = Math.floor(positions[3 * particle1Index + 0]/systemSize*cellList.numberOfCells)
      const cy = Math.floor(positions[3 * particle1Index + 1]/systemSize*cellList.numberOfCells)
      const cz = Math.floor(positions[3 * particle1Index + 2]/systemSize*cellList.numberOfCells)
      
      for(let dx=-1; dx<=1; dx++) {
        for(let dy=-1; dy<=1; dy++) {
          for(let dz=-1; dz<=1; dz++) {
            const cellIndex = cellList.getCellIndexPeriodic(cx + dx, cy + dy, cz + dz)
            for (let i = 0; i < cellList.cellCount[cellIndex]; i++) {
              const particle2Index = cellList.cells[cellIndex][i]
              if (particle1Index === particle2Index) {
                  continue
              }
              let deltaX = positions[3 * particle1Index + 0] - positions[3 * particle2Index + 0]
              let deltaY = positions[3 * particle1Index + 1] - positions[3 * particle2Index + 1]
              let deltaZ = positions[3 * particle1Index + 2] - positions[3 * particle2Index + 2]
              
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
              if (deltaR2 < rCut*rCut) {
                this.neighbors[particle1Index][this.neighborCount[particle1Index]++] = particle2Index
                // this.neighbors[particle2Index][this.neighborCount[particle2Index]++] = particle1Index
                const key = `${Math.min(particle1Index, particle2Index)}-${Math.max(particle1Index, particle2Index)}`
                pairs += 1
              }
            }
          }
        }
      }
    }
    // console.log(`Got ${pairs} pairs`)
    const end = performance.now()
    this.time += end-start
  }

  buildFast = (numParticles: number, systemSize: number, rCut: number, cellList: CellList, positions: Float32Array) => {
    const start = performance.now()
    if (numParticles > this.neighborCount.length) {
      this.neighborCount = new Int32Array(numParticles)
      for (let i = 0; i < numParticles; i++) {
        this.neighbors[i] = new Int32Array(1000) // 1000 neighbors per atom
      }
    }
    if (this.positionsAtLastBuild.length !== positions.length) {
      this.positionsAtLastBuild = new Float32Array(positions.length)
      this.positionsAtLastBuild.set(positions)
    }
    this.neighborCount.fill(0)
    let pairs = 0

    const existsMap: {[key: string]: boolean} = {}

    for(let cx=0; cx<cellList.numberOfCells; cx++) {
      for(let cy=0; cy<cellList.numberOfCells; cy++) {
        for(let cz=0; cz<cellList.numberOfCells; cz++) {
          const cellIndex1 = cellList.getCellIndex(cx, cy, cz)
          const cell1 = cellList.cells[cellIndex1]
          
          for(let dx=0; dx<=1; dx++) {
            for(let dy=(dx===0 ? 0 : -1); dy<=1; dy++) {
              for(let dz=(dx===0 && dy===0 ? 0 : -1); dz<=1; dz++) {
                const cellIndex2 = cellList.getCellIndexPeriodic(cx + dx, cy + dy, cz + dz)
                const cell2 = cellList.cells[cellIndex2]
                for(let i=0; i<cellList.cellCount[cellIndex1]; i++) {
                  const particle1Index = cell1[i]
                  for(let j=(dx===0 && dy===0 && dz===0 ? i+1 : 0); j<cellList.cellCount[cellIndex2]; j++) {
                    const particle2Index = cell2[j]
                    if (particle1Index === particle2Index) {
                      continue
                    }

                    let deltaX = positions[3 * particle1Index + 0] - positions[3 * particle2Index + 0]
                    let deltaY = positions[3 * particle1Index + 1] - positions[3 * particle2Index + 1]
                    let deltaZ = positions[3 * particle1Index + 2] - positions[3 * particle2Index + 2]
                    
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
                    if (deltaR2 < rCut*rCut) {
                      this.neighbors[particle1Index][this.neighborCount[particle1Index]++] = particle2Index
                      this.neighbors[particle2Index][this.neighborCount[particle2Index]++] = particle1Index
                      const key = `${Math.min(particle1Index, particle2Index)}-${Math.max(particle1Index, particle2Index)}`
                      // if (existsMap[key] != null) {
                      //   console.log(`Whops, the pair ${key} already exists`)
                      // } else {
                      //   existsMap[key] = true
                      // }
                      pairs += 1
                    }
                  }
                }
              }
            }
          }
        }
      }
      console.log(`Got ${pairs} pairs`)
    }
    const end = performance.now()
    this.time += end-start
  }
}
