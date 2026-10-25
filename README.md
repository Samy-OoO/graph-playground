# Graph Playground

Build a graph on a canvas, then watch BFS and DFS run on it step by step.

- Editor: add, move and delete nodes and edges; directed and weighted graphs; live adjacency list.
- Visualizations: play, pause, step and scrub; adjustable speed; call stack (DFS) and queue (BFS) shown alongside.
- DFS draws the active path in neon blue. Edges that are fully explored turn green, and edges skipped because their target was already visited are dashed orange.

## Getting started

```bash
npm install
npm run dev
```

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | Typecheck and build for production    |
| `npm run typecheck` | Typecheck only                        |
| `npm run lint`      | ESLint                                |
| `npm test`          | Run the tests (Vitest)                |

Keyboard shortcuts: `V` select, `N` add node, `E` add edge, `M` move, `X` delete, `Esc` cancel, `Delete` remove the selected node.

## How the code is organised

```
src/
  App.tsx                 Wires the three hooks to the layout. No logic of its own.
  constants.ts            Canvas size, node radius, speed limits
  tools.ts                The editing tools (label, icon, shortcut, hint)
  types/                  GraphNode, GraphEdge, GraphData, ToolId
  data/                   The sample graph
  utils/                  Pure helpers: geometry, adjacency, labels, edge rules
  algorithms/
    types.ts              AlgorithmStep: one animation frame
    bfs.ts, dfs.ts        Turn a graph into a list of frames
    index.ts              The algorithm registry
  hooks/
    graphReducer.ts       Every way the graph can change (pure, tested)
    useGraph.ts           The graph's data + actions
    useGraphEditor.ts     Tools, selection, dragging, keyboard
    useStepPlayer.ts      Play / pause / next / previous / scrub
    useAlgorithm.ts       Selected algorithm, start node, speed
  components/
    canvas/               GraphCanvas, NodeView, EdgeView, arrowheads
    sidebar/              Tools, settings, visualization controls, call stack / queue
    ui/                   Button, Card
```

The three layers are kept apart on purpose:

1. **Algorithms** only produce data (`AlgorithmStep[]`). They know nothing about React or the screen.
2. **Hooks** hold state: the graph, the editor, and the playback.
3. **Components** only draw what they are given.

### Adding an algorithm

1. Write `generateXSteps(graph, startNodeId): AlgorithmStep[]` in `src/algorithms/`.
   Each step lists which nodes and edges look special (`nodeStatus`, `edgeStatus`), the edge being walked (`traversal`), an optional `structure` to display, and a `message`.
2. Add one entry to `ALGORITHMS` in `src/algorithms/index.ts`, with its legend.

The picker, controls, canvas, legend and caption all pick it up. Nothing else changes.

### Styling

Colours, radii and fonts are tokens in `src/index.css`. Each component has a `*.module.css` next to it.
Node and edge states in the canvas are driven by `data-status` attributes, so the same status names are used in the algorithms, the CSS and the legend.
