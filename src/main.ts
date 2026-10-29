import { App } from './game/app';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas not found');
new App(canvas).start();
