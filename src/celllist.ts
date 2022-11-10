export default class CellList {
    numberOfCells: number
    cells: Int32Array[]
    cellCount: Int32Array
    time: number

    constructor() {
        this.numberOfCells = 0
        this.cells = []
        this.cellCount = new Int32Array()
        this.time = 0
    }

    getCellIndex = (cx: number, cy: number, cz: number) => {
        return cx*this.numberOfCells*this.numberOfCells + cy*this.numberOfCells + cz
    }

    getCellIndexPeriodic = (cx: number, cy: number, cz: number) => {
        return ( (cx+this.numberOfCells) % this.numberOfCells)*this.numberOfCells*this.numberOfCells + ( (cy+this.numberOfCells) % this.numberOfCells)*this.numberOfCells + ( (cz+this.numberOfCells) % this.numberOfCells)
    }

    build = (positions: Float32Array, numParticles: number, systemSize: number, rCut: number) => {
        const start = performance.now()
        this.numberOfCells = Math.floor(systemSize / rCut)
        const numberOfCellsTotal = this.numberOfCells * this.numberOfCells * this.numberOfCells
        if (numberOfCellsTotal > this.cellCount.length) {
            this.cellCount = new Int32Array(numberOfCellsTotal)
            for (let i = 0; i < numberOfCellsTotal; i++) {
                this.cells[i] = new Int32Array(1000) // 1000 particles per cell by default
            }
        }
        this.cellCount.fill(0)

        for (let i = 0; i < numParticles; i++) {
            const cx = Math.floor(positions[3 * i + 0]/systemSize*this.numberOfCells)
            const cy = Math.floor(positions[3 * i + 1]/systemSize*this.numberOfCells)
            const cz = Math.floor(positions[3 * i + 2]/systemSize*this.numberOfCells)
            if (cx < 0 || cx >= this.numberOfCells || cy < 0 || cy >= this.numberOfCells || cz < 0 || cz >= this.numberOfCells) {
            console.log("Got invalid cell indices for position ", positions[3 * i + 0], positions[3 * i + 1], positions[3 * i + 2])
            console.log("Cell indices: ", cx, cy, cz)
            }
            const cellIndex = this.getCellIndex(cx, cy, cz)
            this.cells[cellIndex][this.cellCount[cellIndex]++] = i
        }
        const end = performance.now()
        this.time += end - start
    }

}
