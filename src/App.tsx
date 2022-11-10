import React, {useState, useRef, useEffect} from 'react';
import logo from './logo.svg';
import './App.css';
import { GPU } from 'gpu.js';
import { Visualizer, Particles } from 'omovi';
import * as THREE from 'three'

const gpu = new GPU();

function App() {
  const [visualizer, setVisualizer] = useState<Visualizer>()
  const domElement = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (domElement.current && !visualizer) {
      const newVisualizer = new Visualizer({
        domElement: domElement.current
      })
      setVisualizer(newVisualizer)
      // @ts-ignore
      window.visualizer = newVisualizer
      document.body.removeChild(newVisualizer.cpuStats.dom)
      document.body.removeChild(newVisualizer.memoryStats.dom)
      newVisualizer.materials.particles.shininess = 50
      newVisualizer.ambientLight.intensity = 0.4
      newVisualizer.pointLight.intensity = 0.6
      newVisualizer.pointLight.decay = 2
      
      let velocities: Float32Array = new Float32Array(0)
      let forces: Float32Array = new Float32Array(0)
      let systemSize = 0
      let numberOfCells = 0
      let numAtoms = 0
      let particles: Particles
      const cells: number[][] = []
      const neighbors: number[][] = []

      let timeCellList = 0
      let timeNeighborList = 0
      let timeForces = 0
      
      const createFCC = (numCells: number, latticeConstant: number) => {
        numAtoms = 4 * numCells * numCells * numCells
        particles = new Particles(numAtoms);
        velocities = new Float32Array(3 * numAtoms)
        forces = new Float32Array(3 * numAtoms)
        
        const xCell = [0, 0.5, 0.5, 0]
        const yCell = [0, 0.5, 0, 0.5]
        const zCell = [0, 0, 0.5, 0.5]
    
        let count = 0
        for (let i = 0; i < numCells; i++) {
          for (let j = 0; j < numCells; j++) {
            for (let k = 0; k < numCells; k++) {
              for(let l=0; l<4; l++) {
                particles.positions[3 * count + 0] = (i+xCell[l])*latticeConstant
                particles.positions[3 * count + 1] = (j+yCell[l])*latticeConstant
                particles.positions[3 * count + 2] = (k+zCell[l])*latticeConstant
                particles.indices[count] = count
                particles.types[count] = 1
                velocities[3 * count + 0] = (Math.random() - 0.5) * 10
                velocities[3 * count + 1] = (Math.random() - 0.5) * 10
                velocities[3 * count + 2] = (Math.random() - 0.5) * 10
                count += 1
              }
            }
          }
        }
        systemSize = latticeConstant * numCells
        particles.count = numAtoms
        newVisualizer.add(particles)
      }

      const setupCellList = (rCut: number) => {
        numberOfCells = Math.floor(systemSize / rCut)
      }

      const getCellIndex = (cx: number, cy: number, cz: number) => {
        return cx*numberOfCells*numberOfCells + cy*numberOfCells + cz
      }

      const getCellIndexPeriodic = (cx: number, cy: number, cz: number) => {
        return ( (cx+numberOfCells) % numberOfCells)*numberOfCells*numberOfCells + ( (cy+numberOfCells) % numberOfCells)*numberOfCells + ( (cz+numberOfCells) % numberOfCells)
      }

      const createCellList = (cells: number[][], positions: Float32Array, rCut: number, numAtoms: number, ) => {
        const start = performance.now()
        const numberOfCellsTotal = numberOfCells * numberOfCells * numberOfCells
        // Clear cells
        for (let i = 0; i < numberOfCellsTotal; i++) {
          cells[i] = []
        }

        for (let i = 0; i < numAtoms; i++) {
          const cx = Math.floor(positions[3 * i + 0]/systemSize*numberOfCells)
          const cy = Math.floor(positions[3 * i + 1]/systemSize*numberOfCells)
          const cz = Math.floor(positions[3 * i + 2]/systemSize*numberOfCells)
          const cellIndex = getCellIndex(cx, cy, cz)
          cells[cellIndex].push(i)
        }
        const stop = performance.now()
        timeCellList += stop-start
      }

      const createNeighborList = (rShell: number, numAtoms: number, numberOfCells: number, systemSize: number, positions: Float32Array) => {
        const start = performance.now()
        // Clear neighbor list
        for (let i = 0; i < numAtoms; i++) {
          neighbors[i] = []
        }

        for(let cx=0; cx<numberOfCells; cx++) {
          for(let cy=0; cy<numberOfCells; cy++) {
            for(let cz=0; cz<numberOfCells; cz++) {
              const cellIndex1 = getCellIndex(cx, cy, cz)
              const cell1 = cells[cellIndex1]
              
              for(let dx=0; dx<=1; dx++) {
                for(let dy=(dx===0 ? 0 : -1); dy<=1; dy++) {
                  for(let dz=(dx===0 && dy===0 ? 0 : -1); dz<=1; dz++) {
                    const cellIndex2 = getCellIndexPeriodic(cx + dx, cy + dy, cz + dz)
                    const cell2 = cells[cellIndex2]
                    console.log(cellIndex1, cellIndex2)
                    for(let i=0; i<cell1.length; i++) {
                      const particle1Index = cell1[i]
                      for(let j=(dx===0 && dy===0 && dz===0 ? i+1 : 0); j<cell2.length; j++) {
                        const particle2Index = cell2[j]
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
                        if (deltaR2 < rShell*rShell) {
                          neighbors[particle1Index].push(particle2Index)
                          neighbors[particle2Index].push(particle1Index)
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        const stop = performance.now()
        timeNeighborList += (stop-start)
      }

      const calculateLJ = (epsilon: number, sigma: number, positions: Float32Array, forces: Float32Array, neighbors: number[][], numAtoms: number, systemSize: number, rCut: number) => {
        const start = performance.now()
        const sigma6 = Math.pow(sigma, 6)
        const epsilon24 = 24 * epsilon
        // Clear forces
        forces.fill(0)
        
        for (let particleIndex1 = 0; particleIndex1 < numAtoms; particleIndex1++) {
          const atomNeighbors = neighbors[particleIndex1]
          for (let j = 0; j < atomNeighbors.length; j++) {
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
            if (deltaR2 < rCut*rCut) {
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
        const stop = performance.now()
        timeForces += stop-start
      }

      const calculateLJCells = (epsilon: number, sigma: number, positions: Float32Array, forces: Float32Array, neighbors: number[][], numAtoms: number, systemSize: number, rCut: number) => {
        const sigma6 = Math.pow(sigma, 6)
        const epsilon24 = 24 * epsilon
        // Clear forces
        forces.fill(0)
        
        for (let particleIndex1 = 0; particleIndex1 < numAtoms; particleIndex1++) {
          const atomNeighbors = neighbors[particleIndex1]
          const cx = Math.floor(positions[3 * particleIndex1 + 0]/systemSize*numberOfCells)
          const cy = Math.floor(positions[3 * particleIndex1 + 1]/systemSize*numberOfCells)
          const cz = Math.floor(positions[3 * particleIndex1 + 2]/systemSize*numberOfCells)
          
          for(let dx=-1; dx<=1; dx++) {
            for(let dy=-1; dy<=1; dy++) {
              for(let dz=-1; dz<=1; dz++) {
                const cellIndex = getCellIndexPeriodic(cx + dx, cy + dy, cz + dz)
                for (let i = 0; i < cells[cellIndex].length; i++) {
                  const particleIndex2 = cells[cellIndex][i]
                  if (particleIndex1 === particleIndex2) {
                    continue
                  }
                    
                  let deltaX = positions[3 * particleIndex1 + 0] - positions[3 * particleIndex2 + 0]
                  let deltaY = positions[3 * particleIndex1 + 1] - positions[3 * particleIndex2 + 1]
                  let deltaZ = positions[3 * particleIndex1 + 2] - positions[3 * particleIndex2 + 2]
                  // console.log(`P1 ${particleIndex1}: ${positions[3 * particleIndex1 + 0]}, ${positions[3 * particleIndex1 + 1]}, ${positions[3 * particleIndex1 + 2]}`)
                  // console.log(`P2 ${particleIndex2}: ${positions[3 * particleIndex2 + 0]}, ${positions[3 * particleIndex2 + 1]}, ${positions[3 * particleIndex2 + 2]}`)
                  
                  
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
        let fx = 0
        let fy = 0
        let fz = 0
        for (let i = 0; i < numAtoms; i++) {
          fx += forces[3 * i + 0]
          fy += forces[3 * i + 1]
          fz += forces[3 * i + 2]
        }
        console.log(fx, fy, fz)
      }


      const integrate = (dt: number, positions: Float32Array) => {
        const mass = 1.0

        // Half kick
        for (let i = 0; i < numAtoms; i++) {
          velocities[3 * i + 0] += forces[3 * i + 0] / mass * 0.5 * dt
          velocities[3 * i + 1] += forces[3 * i + 1] / mass * 0.5 * dt
          velocities[3 * i + 2] += forces[3 * i + 2] / mass * 0.5 * dt
        }

        // Move
        for (let i = 0; i < numAtoms; i++) {
          positions[3 * i + 0] += velocities[3 * i + 0] * dt
          positions[3 * i + 1] += velocities[3 * i + 1] * dt
          positions[3 * i + 2] += velocities[3 * i + 2] * dt
          
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

        createCellList(cells, particles.positions, rCut, numAtoms)
        createNeighborList(rShell, numAtoms, numberOfCells, systemSize, particles.positions)
        calculateLJCells(epsilon, sigma, particles.positions, forces, neighbors, numAtoms, systemSize, rCut)

        // Half kick
        for (let i = 0; i < numAtoms; i++) {
          velocities[3 * i + 0] += forces[3 * i + 0] / mass * 0.5 * dt
          velocities[3 * i + 1] += forces[3 * i + 1] / mass * 0.5 * dt
          velocities[3 * i + 2] += forces[3 * i + 2] / mass * 0.5 * dt
        }
      }

      const epsilon = 1.0
      const sigma = 3.405
      const rCut = 2.5 * sigma
      const rShell = rCut + 0.3
      const dt = 0.001

      createFCC(5, sigma)
      setupCellList(rCut)
      createCellList(cells, particles.positions, rCut, numAtoms)
      createNeighborList(rShell, numAtoms, numberOfCells, systemSize, particles.positions)
      calculateLJCells(epsilon, sigma, particles.positions, forces, neighbors, numAtoms, systemSize, rCut)
      // integrate(dt, particles.positions)
      // particles.markNeedsUpdate()

      let timestepCount = 0
      // setInterval(() => {
      //   integrate(dt, particles.positions)
      //   particles.markNeedsUpdate()
      //   if (++timestepCount % 100 === 0) {
      //     console.log(`Time: Cell list: ${timeCellList / timestepCount} neighbor list: ${timeNeighborList / timestepCount} forces: ${timeForces / timestepCount}`)
      //   }
      // }, 1)
    }
  }, [domElement, setVisualizer, visualizer])

  return (
    <div style={{ height: '100vh', width: '100vh'  }} ref={domElement} /> 
  );
}

export default App;
