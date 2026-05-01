/// <reference types="vite/client" />

declare module 'stats.js' {
    export default class Stats {
        dom: HTMLDivElement
        showPanel(panel: number): void
        begin(): void
        end(): void
    }
}

type FaceLandmark = [number, number, number]

interface FacemeshFace {
    scaledMesh: FaceLandmark[]
}

interface FacemeshModel {
    estimateFaces(options: { input: HTMLImageElement | HTMLVideoElement }): Promise<FacemeshFace[]>
}

interface FaceLandmarksDetectionLib {
    SupportedPackages: { mediapipeFacemesh: string }
    load(pkg: string): Promise<FacemeshModel>
}

interface Window {
    faceLandmarksDetection: FaceLandmarksDetectionLib
    tf: { getBackend(): string }
}
