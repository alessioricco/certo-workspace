# Third-party notices

Alien Trekking uses the open-source packages below. Three.js and simplex-noise
are bundled into the game; the others are development tools (build, tests,
lint, types). Transitive dependencies carry their own licenses, listed in
`package-lock.json`.

## Runtime (bundled into the game)

| Package | Version | License | Use |
| --- | --- | --- | --- |
| [three](https://github.com/mrdoob/three.js) | 0.187.0 | MIT | 3D rendering: meshes, materials, camera, fog, lights, glTF model loading (GLTFLoader) |
| [simplex-noise](https://github.com/jwagner/simplex-noise.js) | 4.0.3 | MIT | Terrain noise |

## Development

| Package | Version | License | Use |
| --- | --- | --- | --- |
| [vite](https://github.com/vitejs/vite) | 6.4.6 | MIT | Dev server and build |
| [vitest](https://github.com/vitest-dev/vitest) | 3.2.7 | MIT | Unit tests |
| [typescript](https://github.com/microsoft/TypeScript) | 5.9.3 | Apache-2.0 | Type checking |
| [eslint](https://github.com/eslint/eslint) | 9.39.5 | MIT | Linting |
| [@eslint/js](https://github.com/eslint/eslint) | 9.39.5 | MIT | ESLint recommended rules |
| [typescript-eslint](https://github.com/typescript-eslint/typescript-eslint) | 8.72.2 | MIT | TypeScript lint rules |
| [globals](https://github.com/sindresorhus/globals) | 17.14.0 | MIT | Global names for ESLint |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | 26.6.6 | MIT | Node.js type definitions |
| [@types/three](https://github.com/DefinitelyTyped/DefinitelyTyped) | 0.187.0 | MIT | TypeScript declarations for three |
