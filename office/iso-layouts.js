// Room plans for the five isometric floors. Coordinates are tiles: x runs down-right, y down-left,
// and the back walls stand on x = 0 (west) and y = 0 (north).
//
// desks:  id → [x, y, dir]. dir 'x' spans (x, y)…(x+1, y) and is worked from (x, y-1), facing down-left;
//         dir 'y' spans (x, y)…(x, y+1) and is worked from (x-1, y), facing down-right.
// walls:  low partitions. { axis: 'x', at, from, to, doors } stands on the line x = at between tiles
//         at-1 and at, for y in [from, to); doors are the y values left open. axis 'y' mirrors it.
// north / west: decals on the back walls, positioned by u (tiles from the corner).
// places: where the daily routines in life.js walk to: [x, y, facing] (facing ne / nw / se / sw).
// slots:  where bought furniture goes; each has the tile it stands on and the tile used to reach it.

export const layouts = {
  1: {
    w: 14, h: 11, wallH: 46, theme: 'studio',
    rooms: [
      { name: '開放工作區', x: 0, y: 0, w: 9, h: 11, floor: 'oak' },
      { name: '茶水角', x: 9, y: 0, w: 5, h: 5, floor: 'tatami' },
      { name: '會議角', x: 9, y: 5, w: 5, h: 6, floor: 'sage' }
    ],
    walls: [
      { axis: 'x', at: 9, from: 0, to: 11, doors: [2, 8] },
      { axis: 'y', at: 5, from: 9, to: 14, doors: [11] }
    ],
    north: [
      { kind: 'window', u: 1, len: 3 }, { kind: 'slot', id: 'w1', u: 4.5 }, { kind: 'window', u: 5, len: 3 },
      { kind: 'shelf', u: 10, len: 2 }, { kind: 'clock', u: 12.6 }
    ],
    west: [
      { kind: 'board', u: 1, len: 2 }, { kind: 'window', u: 3.5, len: 2.5 }, { kind: 'slot', id: 'w2', u: 6.6 },
      { kind: 'door', u: 8, len: 2 }
    ],
    desks: {
      claude: [2, 3, 'x'], codex: [6, 3, 'x'],
      'claude-research': [1, 7, 'x'], 'claude-review': [3, 7, 'x'],
      'codex-build': [5, 7, 'x'], 'codex-test': [7, 7, 'x']
    },
    rugs: [{ x: 10, y: 1, w: 3, d: 3, kind: 'round', colors: ['#b7a77e', '#d8caa0'] }, { x: 10, y: 6, w: 3, d: 4, kind: 'plain', colors: ['#7d9c84', '#9fb9a2'] }],
    props: [
      ['plant', 0, 0], ['cabinet', 4, 0, { dir: 'y' }], ['plant', 8, 0], ['rack', 8, 1],
      ['plant', 0, 5], ['shelf', 4, 4, { dir: 'y' }], ['bench', 8, 4],
      ['cabinet', 4, 10, { dir: 'y' }], ['plant', 0, 10],
      ['sofa', 10, 1, { dir: 'x', len: 2 }], ['table', 10, 3, { len: 2 }], ['counter', 13, 0, { dir: 'y', len: 2 }],
      ['roundTable', 10, 7], ['boardStand', 13, 7], ['plant', 9, 6]
    ],
    places: {
      board: [0, 1, 'nw'], boardRight: [0, 2, 'nw'], windowLeft: [2, 1, 'ne'], windowRight: [6, 1, 'ne'],
      plantLeft: [1, 5, 'nw'], shelf: [4, 5, 'ne'], shelfLeft: [4, 9, 'sw'], rack: [8, 2, 'ne'], workbench: [8, 5, 'ne'],
      loungeLeft: [9, 3, 'se'], loungeRight: [12, 3, 'nw']
    },
    slots: {
      f1: { at: [9, 0], use: [9, 1, 'ne'] }, f2: { at: [13, 4], use: [12, 4, 'se'] }, f3: { at: [9, 10], use: [9, 9, 'sw'] },
      f4: { at: [13, 10], use: [12, 10, 'se'] }, f5: { at: [13, 5], use: [12, 5, 'se'] }, f6: { at: [8, 10], use: [7, 10, 'se'] }
    }
  },

  2: {
    w: 16, h: 12, wallH: 50, theme: 'loft',
    rooms: [
      { name: '開放工作區', x: 0, y: 0, w: 11, h: 12, floor: 'concrete' },
      { name: '機房', x: 11, y: 0, w: 5, h: 5, floor: 'grate' },
      { name: '吧台休息區', x: 11, y: 5, w: 5, h: 7, floor: 'herringbone' }
    ],
    walls: [
      { axis: 'x', at: 11, from: 0, to: 5, doors: [3], style: 'glass' },
      { axis: 'x', at: 11, from: 5, to: 12, doors: [7, 10] },
      { axis: 'y', at: 5, from: 11, to: 16, doors: [13] }
    ],
    north: [
      { kind: 'window', u: 0.5, len: 6 }, { kind: 'board', u: 7, len: 3 }, { kind: 'slot', id: 'w1', u: 10.4 },
      { kind: 'shelf', u: 13, len: 2.5 }
    ],
    west: [{ kind: 'window', u: 1, len: 3 }, { kind: 'door', u: 5, len: 2 }, { kind: 'window', u: 7.5, len: 3 }, { kind: 'slot', id: 'w2', u: 11 }],
    desks: {
      claude: [1, 3, 'x'], 'claude-research': [3, 3, 'x'], 'claude-review': [5, 3, 'x'],
      codex: [1, 8, 'x'], 'codex-build': [3, 8, 'x'], 'codex-test': [5, 8, 'x']
    },
    rugs: [{ x: 12, y: 9, w: 3, d: 3, kind: 'kilim', colors: ['#7a2f28', '#c9a86a'] }],
    props: [
      ['rack', 12, 0], ['rack', 13, 0], ['rack', 14, 0], ['bench', 15, 2], ['plant', 8, 3], ['pillar', 8, 6],
      ['shelf', 9, 5, { dir: 'x' }], ['cabinet', 0, 11, { dir: 'x' }], ['plant', 10, 0], ['plant', 0, 0],
      ['counter', 13, 7, { dir: 'x', len: 2 }], ['stool', 13, 6], ['stool', 14, 6], ['sofa', 13, 10, { dir: 'x', len: 2 }],
      ['plant', 11, 5]
    ],
    places: {
      board: [8, 0, 'ne'], boardRight: [9, 0, 'ne'], windowLeft: [0, 2, 'nw'], windowRight: [0, 9, 'nw'],
      plantLeft: [8, 4, 'ne'], shelf: [9, 6, 'ne'], shelfLeft: [1, 11, 'nw'], rack: [13, 1, 'ne'], workbench: [14, 2, 'se'],
      loungeLeft: [12, 7, 'se'], loungeRight: [15, 7, 'nw']
    },
    slots: {
      f1: { at: [15, 4], use: [14, 4, 'se'] }, f2: { at: [11, 11], use: [12, 11, 'nw'] }, f3: { at: [15, 11], use: [15, 10, 'sw'] },
      f4: { at: [10, 1], use: [9, 1, 'se'] }, f5: { at: [10, 11], use: [9, 11, 'se'] }, f6: { at: [7, 11], use: [7, 10, 'sw'] }
    }
  },

  3: {
    w: 18, h: 13, wallH: 50, theme: 'mid',
    rooms: [
      { name: 'Claude 工作室', x: 0, y: 0, w: 9, h: 6, floor: 'mustard' },
      { name: 'Codex 工作室', x: 9, y: 0, w: 9, h: 6, floor: 'teal' },
      { name: '交誼廳', x: 0, y: 6, w: 12, h: 7, floor: 'terrazzo' },
      { name: '會議室', x: 12, y: 6, w: 6, h: 7, floor: 'parquet' }
    ],
    walls: [
      { axis: 'x', at: 9, from: 0, to: 6, doors: [] },
      { axis: 'y', at: 6, from: 0, to: 18, doors: [3, 11, 15] },
      { axis: 'x', at: 12, from: 6, to: 13, doors: [9] }
    ],
    north: [
      { kind: 'window', u: 1, len: 2.5 }, { kind: 'window', u: 4, len: 2.5 }, { kind: 'slot', id: 'w1', u: 7.4 },
      { kind: 'board', u: 10, len: 2 }, { kind: 'window', u: 13, len: 2.5 }, { kind: 'clock', u: 16.6 }
    ],
    west: [{ kind: 'board', u: 1, len: 2 }, { kind: 'shelf', u: 3.5, len: 2.2 }, { kind: 'door', u: 8, len: 2 }, { kind: 'slot', id: 'w2', u: 11.2 }],
    desks: {
      claude: [2, 3, 'x'], 'claude-research': [6, 1, 'y'], 'claude-review': [6, 4, 'y'],
      codex: [12, 3, 'x'], 'codex-build': [15, 1, 'y'], 'codex-test': [15, 4, 'y']
    },
    rugs: [{ x: 3, y: 8, w: 4, d: 4, kind: 'round', colors: ['#c38a2c', '#e4bb5a'] }, { x: 13, y: 8, w: 4, d: 3, kind: 'plain', colors: ['#2f6d69', '#4f948d'] }],
    props: [
      ['plant', 8, 0], ['plant', 9, 0], ['rack', 17, 5], ['bench', 17, 2], ['plant', 0, 5],
      ['sofa', 4, 8, { dir: 'x', len: 2 }], ['table', 4, 10, { len: 2 }], ['armchair', 2, 10], ['cabinet', 0, 12, { dir: 'x' }],
      ['longTable', 14, 9], ['plant', 12, 12], ['plant', 11, 7], ['boardStand', 17, 9]
    ],
    places: {
      board: [0, 2, 'nw'], boardRight: [11, 0, 'ne'], windowLeft: [3, 0, 'ne'], windowRight: [14, 0, 'ne'],
      plantLeft: [8, 1, 'ne'], shelf: [0, 4, 'nw'], shelfLeft: [1, 12, 'nw'], rack: [16, 5, 'se'], workbench: [16, 2, 'se'],
      loungeLeft: [3, 11, 'se'], loungeRight: [6, 11, 'nw']
    },
    slots: {
      f1: { at: [8, 7], use: [8, 8, 'ne'] }, f2: { at: [11, 12], use: [10, 12, 'se'] }, f3: { at: [7, 12], use: [7, 11, 'sw'] },
      f4: { at: [17, 12], use: [16, 12, 'se'] }, f5: { at: [17, 7], use: [16, 7, 'se'] }, f6: { at: [9, 9], use: [9, 10, 'ne'] }
    }
  },

  4: {
    w: 20, h: 14, wallH: 54, theme: 'forest',
    rooms: [
      { name: 'Claude 工作區', x: 0, y: 0, w: 6, h: 9, floor: 'deck' },
      { name: '閱讀角', x: 0, y: 9, w: 6, h: 5, floor: 'moss' },
      { name: '中庭步道', x: 6, y: 0, w: 8, h: 4, floor: 'stone' },
      { name: '森林中庭', x: 6, y: 4, w: 8, h: 6, floor: 'grass' },
      { name: '南側步道', x: 6, y: 10, w: 8, h: 4, floor: 'stone' },
      { name: 'Codex 工作區', x: 14, y: 0, w: 6, h: 14, floor: 'deck' }
    ],
    walls: [
      { axis: 'y', at: 4, from: 6, to: 14, doors: [10], style: 'hedge' },
      { axis: 'y', at: 10, from: 6, to: 14, doors: [9], style: 'hedge' },
      { axis: 'x', at: 6, from: 4, to: 10, doors: [7], style: 'hedge' },
      { axis: 'x', at: 14, from: 4, to: 10, doors: [6], style: 'hedge' },
      { axis: 'y', at: 9, from: 0, to: 6, doors: [3] }
    ],
    north: [
      { kind: 'window', u: 1, len: 4 }, { kind: 'door', u: 8, len: 2 }, { kind: 'slot', id: 'w1', u: 11.5 },
      { kind: 'window', u: 14, len: 3 }, { kind: 'board', u: 17.3, len: 2 }
    ],
    west: [{ kind: 'board', u: 1, len: 2 }, { kind: 'window', u: 4, len: 3 }, { kind: 'slot', id: 'w2', u: 7.6 }, { kind: 'shelf', u: 10, len: 2.5 }],
    desks: {
      claude: [2, 2, 'x'], 'claude-research': [1, 5, 'x'], 'claude-review': [4, 5, 'x'],
      codex: [16, 2, 'x'], 'codex-build': [15, 6, 'x'], 'codex-test': [18, 6, 'x']
    },
    rugs: [{ x: 1, y: 10, w: 4, d: 3, kind: 'round', colors: ['#a98c5c', '#c2a777'] }],
    props: [
      ['fountainBig', 10, 6], ['tree', 8, 5], ['tree', 12, 8], ['flowerBed', 7, 8], ['flowerBed', 12, 5], ['bench', 19, 12],
      ['rack', 19, 10], ['plant', 0, 8], ['plant', 19, 0], ['plant', 6, 0], ['plant', 13, 0], ['cabinet', 5, 13, { dir: 'y' }],
      ['armchair', 1, 11], ['armchair', 3, 12], ['table', 2, 12, { len: 1 }], ['flowerBed', 6, 11], ['flowerBed', 13, 12]
    ],
    places: {
      board: [0, 2, 'nw'], boardRight: [18, 0, 'ne'], windowLeft: [3, 0, 'ne'], windowRight: [15, 0, 'ne'],
      plantLeft: [7, 5, 'se'], shelf: [0, 11, 'nw'], shelfLeft: [4, 13, 'se'], rack: [18, 10, 'se'], workbench: [18, 12, 'se'],
      loungeLeft: [9, 7, 'se'], loungeRight: [12, 7, 'nw']
    },
    slots: {
      f1: { at: [7, 9], use: [8, 9, 'nw'] }, f2: { at: [13, 9], use: [12, 9, 'se'] }, f3: { at: [13, 4], use: [12, 4, 'se'] },
      f4: { at: [5, 10], use: [4, 10, 'se'] }, f5: { at: [19, 13], use: [18, 13, 'se'] }, f6: { at: [14, 13], use: [15, 13, 'nw'] }
    }
  },

  5: {
    w: 20, h: 15, wallH: 58, theme: 'penthouse',
    rooms: [
      { name: 'Claude 主管室', x: 0, y: 0, w: 7, h: 6, floor: 'navy' },
      { name: 'Codex 主管室', x: 7, y: 0, w: 7, h: 6, floor: 'navy' },
      { name: '團隊大廳', x: 0, y: 6, w: 14, h: 9, floor: 'marble' },
      { name: '頂樓酒廊', x: 14, y: 0, w: 6, h: 15, floor: 'walnut' }
    ],
    walls: [
      { axis: 'x', at: 7, from: 0, to: 6, doors: [], style: 'glass' },
      { axis: 'y', at: 6, from: 0, to: 14, doors: [3, 10], style: 'glass' },
      { axis: 'x', at: 14, from: 0, to: 15, doors: [3, 10], style: 'glass' }
    ],
    north: [
      { kind: 'glass', u: 0.4, len: 6.2 }, { kind: 'slot', id: 'w1', u: 6.9 }, { kind: 'glass', u: 7.6, len: 6 },
      { kind: 'door', u: 15, len: 2 }, { kind: 'bar', u: 17.3, len: 2.5 }
    ],
    west: [{ kind: 'board', u: 1, len: 2 }, { kind: 'slot', id: 'w2', u: 4.4 }, { kind: 'glass', u: 6.5, len: 4 }, { kind: 'board', u: 11, len: 2.2 }],
    desks: {
      claude: [3, 3, 'x'], codex: [10, 3, 'x'],
      'claude-research': [2, 9, 'x'], 'claude-review': [5, 9, 'x'], 'codex-build': [8, 9, 'x'], 'codex-test': [11, 9, 'x']
    },
    rugs: [
      { x: 1, y: 1, w: 5, d: 4, kind: 'plain', colors: ['#4a2026', '#6e2f36'] }, { x: 8, y: 1, w: 5, d: 4, kind: 'plain', colors: ['#18283c', '#264260'] },
      { x: 15, y: 2, w: 4, d: 5, kind: 'kilim', colors: ['#1c2a44', '#c9a45c'] }
    ],
    props: [
      ['armchair', 1, 4], ['plant', 0, 0], ['armchair', 8, 4], ['plant', 13, 0],
      ['table', 17, 4, { len: 2 }], ['sofa', 16, 2, { dir: 'x', len: 2 }], ['counter', 18, 7, { dir: 'y', len: 3 }], ['stool', 17, 7], ['stool', 17, 9],
      ['plant', 7, 7], ['shelf', 13, 7, { dir: 'y' }], ['cabinet', 0, 14, { dir: 'x' }], ['rack', 13, 14], ['bench', 9, 14],
      ['sofa', 15, 12, { dir: 'x', len: 2 }], ['plant', 14, 14], ['pillar', 6, 12]
    ],
    places: {
      board: [0, 2, 'nw'], boardRight: [0, 12, 'nw'], windowLeft: [5, 0, 'ne'], windowRight: [12, 0, 'ne'],
      plantLeft: [7, 8, 'ne'], shelf: [12, 7, 'se'], shelfLeft: [1, 14, 'nw'], rack: [12, 14, 'se'], workbench: [9, 13, 'sw'],
      loungeLeft: [16, 4, 'se'], loungeRight: [19, 4, 'nw']
    },
    slots: {
      f1: { at: [19, 0], use: [19, 1, 'ne'] }, f2: { at: [14, 13], use: [15, 13, 'nw'] }, f3: { at: [19, 14], use: [18, 14, 'se'] },
      f4: { at: [6, 5], use: [5, 5, 'se'] }, f5: { at: [13, 5], use: [12, 5, 'se'] }, f6: { at: [0, 7], use: [1, 7, 'nw'] }
    }
  }
};

export const footprints = {
  sofa: o => o.dir === 'y' ? [1, o.len || 2] : [o.len || 2, 1],
  table: o => o.dir === 'y' ? [1, o.len || 2] : [o.len || 2, 1],
  counter: o => o.dir === 'y' ? [1, o.len || 2] : [o.len || 2, 1],
  roundTable: () => [2, 2], longTable: () => [2, 2], fountainBig: () => [2, 2]
};
export const footprintOf = (kind, opts = {}) => footprints[kind]?.(opts) ?? [1, 1];
// Small things you can walk around but not through; rugs and doors never block.
export function deskTiles([x, y, dir]) { return dir === 'y' ? [[x, y], [x, y + 1]] : [[x, y], [x + 1, y]]; }
export function seatOf([x, y, dir]) {
  return dir === 'y'
    ? { tile: [x - 1, y], point: [x + 0.05, y + 0.62], facing: 'se' }
    : { tile: [x, y - 1], point: [x + 0.62, y + 0.05], facing: 'sw' };
}
