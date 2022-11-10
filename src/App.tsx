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
      
      let timeCellList = 0
      let timeNeighborList = 0
      let timeForces = 0

      const epsilon = 1.0
      const sigma = 3.405
      const rCut = 2.5 * sigma
      const dt = 0.001
      const potential = new LennardJones({epsilon, sigma, rCut})
      const integrator = new Integrator({dt, potential})
      const system = new System({capacity: 10000})
      system.createFCC(3, sigma)
      
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
      setInterval(() => {
        integrator.integrate(system)
        system.particles.markNeedsUpdate()
        if (++timestepCount % 100 === 0) {
          // console.log(`Time: Cell list: ${timeCellList / timestepCount} neighbor list: ${timeNeighborList / timestepCount} forces: ${timeForces / timestepCount}`)
        }
      }, 10)
    }
  }, [domElement, setVisualizer, visualizer])

  return (
    <div style={{ height: '100vh', width: '100vh'  }} ref={domElement} /> 
  );
}

export default App;
