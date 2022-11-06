import React, {useState, useRef, useEffect} from 'react';
import logo from './logo.svg';
import './App.css';
import { GPU } from 'gpu.js';
import { Visualizer, Particles } from 'omovi';
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
      
      let vx, vy, vz, fx, fy, fz: Float32Array

      const createFCC = (numCells: number, latticeConstant: number) => {
        const numAtoms = 4 * numCells * numCells * numCells
        const particles = new Particles(numAtoms);
        vx = new Float32Array(numAtoms)
        vy = new Float32Array(numAtoms)
        vz = new Float32Array(numAtoms)
        fx = new Float32Array(numAtoms)
        fy = new Float32Array(numAtoms)
        fz = new Float32Array(numAtoms)

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
                vx[count] = 1.0
                vy[count] = 1.0
                vz[count] = 1.0
                count += 1
              }
            }
          }
        }
        particles.count = numAtoms
        newVisualizer.add(particles)
      }
      createFCC(10, 3.405)
    }
  }, [domElement, setVisualizer, visualizer])

  return (
    <div style={{ height: '100vh', width: '100vh'  }} ref={domElement} /> 
  );
}

export default App;
