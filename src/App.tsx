import React, {useState, useRef, useEffect} from 'react';
import logo from './logo.svg';
import './App.css';
import { GPU } from 'gpu.js';
import { Visualizer, Particles } from 'omovi';
import * as THREE from 'three'
import LennardJones from './force';
import Integrator from './integrator';
import System from './system';

const gpu = new GPU();
const LJ = gpu.createKernel(function(positions: Float32Array, neighbors: Float32Array[], neighborCount: Float32Array) { 
  let epsilon24: number = 24
  let sigma6: number = Math.pow(3.405, 6)

  let f = 0
  // const delta = [
  //   10, 20, 30
  // ]
  for (let i = 0; i < neighborCount[this.thread.y]; i++) {
    const delta = [
      positions[3 * this.thread.y + 0] - positions[3 * neighbors[this.thread.y][i] + 0],
      positions[3 * this.thread.y + 1] - positions[3 * neighbors[this.thread.y][i] + 1],
      positions[3 * this.thread.y + 2] - positions[3 * neighbors[this.thread.y][i] + 2]
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
    // const force = epsilon24*sigma6*oneOverDr6*(2*sigma6*oneOverDr6 - 1)*oneOverDr2
    f += force * delta[this.thread.x]
  }
  
  return f
}).setOutput([3,2]).setConstants({
  systemSize: 20,
})

const LJCells = gpu.createKernel(function(positions: Float32Array, cells: Float32Array[], cellCount: Float32Array) { 
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
          // const force = epsilon24*sigma6*oneOverDr6*(2*sigma6*oneOverDr6 - 1)*oneOverDr2
          f += force * delta[this.thread.x]
        }
      }
    }
  }
  
  return f
}).setOutput([3,2]).setConstants({
  systemSize: 20,
})

const positions: Float32Array = new Float32Array([1,1,1,2,3,17])
const neighbors: Float32Array[] = [
  new Float32Array([1]),
  new Float32Array([0])
]
const neighborCount: Float32Array = new Float32Array([1,1])

const cells: Float32Array[] = [
  new Float32Array([1]),
  new Float32Array([0])
]
const cellCount: Float32Array = new Float32Array([1,1])

// console.log("Shader: ", test.toString(positions, neighbors, neighborCount))
// const c = test(positions, neighbors, neighborCount) as number[][];

// console.log("c: ", c)

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
      
      const epsilon = 1.0
      const sigma = 3.405
      const rCut = 2.5 * sigma
      const dt = 0.001
      const potential = new LennardJones({epsilon, sigma, rCut})
      const integrator = new Integrator({dt, potential})
      const system = new System({capacity: 40000})
      system.createFCC(20, sigma)
      // system.size = 40
      system.resetVelocities(50.0)
      
      newVisualizer.add(system.particles)
      window.onkeydown = (ev) => {
        if (ev.key === " ") {
          console.log("integrating with dt = ", dt)
          integrator.integrate(system)
          system.particles.markNeedsUpdate()
        }
      }
      console.log("Got the particles ", system.particles)

      let timestepCount = 0
      // setInterval(() => {
      //   console.log(`Integrating ${system.particles.count} particles`)
      //   integrator.integrate(system)
      //   system.particles.markNeedsUpdate()
      //   if (++timestepCount % 100 === 0) {
      //     console.log(`Time: Cell list: ${ ((potential.cellList ? potential.cellList.time : 0) / timestepCount).toPrecision(3)} neighbor list: ${((potential.neighborList ? potential.neighborList.time : 0) / timestepCount).toPrecision(3)} forces: ${(potential.time / timestepCount).toPrecision(3)} integrate: ${(integrator.time / timestepCount).toPrecision(3)}`)
      //   }
      // }, 1)
    }
  }, [domElement, setVisualizer, visualizer])

  return (
    <div style={{ height: '100vh', width: '100vh'  }} ref={domElement} /> 
  );
}

export default App;
