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
      
      const epsilon = 1.0
      const sigma = 3.405
      const rCut = 2.5 * sigma
      const dt = 0.001
      const potential = new LennardJones({epsilon, sigma, rCut})
      const integrator = new Integrator({dt, potential})
      const system = new System({capacity: 10000})
      system.createFCC(10, sigma)
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
      setInterval(() => {
        console.log(`Integrating ${system.particles.count} particles`)
        integrator.integrate(system)
        system.particles.markNeedsUpdate()
        if (++timestepCount % 100 === 0) {
          console.log(`Time: Cell list: ${ ((potential.cellList ? potential.cellList.time : 0) / timestepCount).toPrecision(3)} neighbor list: ${((potential.neighborList ? potential.neighborList.time : 0) / timestepCount).toPrecision(3)} forces: ${(potential.time / timestepCount).toPrecision(3)} integrate: ${(integrator.time / timestepCount).toPrecision(3)}`)
        }
      }, 1)
    }
  }, [domElement, setVisualizer, visualizer])

  return (
    <div style={{ height: '100vh', width: '100vh'  }} ref={domElement} /> 
  );
}

export default App;
