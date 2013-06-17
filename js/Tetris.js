/**
 * name:    Tetris.js
 * license:    MIT-style license
 * copyright:  Copyright (c) 2012 Andrew Lo <http://cs.ucsb.edu/~andrewlo>
 * version:    1.01
 */

/**
 * Version History:
 * - 1.00: Initial Release
 * - 1.01: Implemented canvas caching (e.g. drawing static items to separate canvas)
 */

// @@TODO:
// - Add 'Controls' menu item
// - Add more options
// - Clean up canvas measurements and magic numbers
// - Export strings
// - Optimize game calculations

// Only expose Tetris to global scope (window.Tetris)
(function (global) {
  'use strict';

  //
  // Core Game object. Runs functions implemented in game state objects.
  //
  var Tetris = (function () {
    var data = {
      currRender:  null,
      gameLoop:    null,
      newRender:  'Tetris.Menu', // Signals state change

      cacheCanvas: null,
      canvas:      null
    };

    return {
      version: '1.01',
      settings: {
        bodyFont: 'Titillium Web',
        fps: 200,
        ghost: true,
        headerFont: 'Lily Script One',
        imgBlock: true,
        size: { h: 22, w: 10 },
        speed: 250,

        canvas: 'gameCnvs'
      },

      get: function (key) {
        return data[key];
      },
      // Send event obj to game state's handleKeys() method
      handleKeys: function (evt) {
        data.currRender.handleKeys(evt);
      },
      initialize: function () {
        data.canvas      =  $(this.settings.canvas);
        data.cacheCanvas  =  document.createElement('canvas');

        window.addEvent('keydown', this.handleKeys);
        // Save CPU cycles if window is not active
        window.addEvent('blur', this.pause.bind(this, true));
        window.addEvent('focus', this.pause.bind(this, false));

        data.blockImg = new Element('img', { src: 'img/block.png' });

        data.blockImg.addEvent('load', function () {
          this.pause(false);
        }.bind(this));
      },
      pause: function (paused) {
        if (paused) {
          clearInterval(data.gameLoop);
        } else {
          data.gameLoop =
            this.run.periodical(1000 / this.settings.fps, this);
        }
      },
      // Check for window resize, updated state. Runs render method of
      //   current game state.
      run: function () {
        var cnvsSize = Math.min(window.innerHeight, window.innerWidth);

        // Check for updated state
        if (data.newRender) {
          var
            scope  =  global,
            levels  =  data.newRender.split('.');

          for (var i = 0; i < levels.length; i++) {
            scope = scope[levels[i]];
          }
          data.currRender  =  scope;
          data.newRender  =  null;

          data.currRender.initialize.call(data.currRender);
          data.currRender.prerender.call(data.currRender);
        }

        if (cnvsSize !== data.canvas.height) {
          data.canvas.height = data.canvas.width = cnvsSize;
          data.cacheCanvas.height = data.cacheCanvas.width = cnvsSize;

          data.currRender.prerender.call(data.currRender);
        }

        data.currRender.update.call(data.currRender);
        data.currRender.render.call(data.currRender);
      },
      set: function (key, val) {
        data[key] = val;
        return this;
      }
    };
  }) ();
  global.Tetris = Tetris;

  // Represents a single Tetrinimo
  // Store layouts in BlockFactory so data is only initialized once
  var Block = (function (proto) {
    var data = {
      layout: null,
      pos: {
        x: 0,
        y: 0
      },
      type: null
    };
    data.type = proto.type;

    var layout = data.layout = [];
    for (var i = 0, j = proto.layout, k = j.length; i < k; i++) {
      layout[i] = [];
      for (var p = 0, q = j[i], r = q.length; p < r; p++) {
        layout[i][p] = q[p];
      }
    }

    data.pos.x =
      Math.floor((Tetris.settings.size.w - layout[0].length) / 2);


    return {
      get: function (key) {
        return data[key];
      },
      set: function (key, val) {
        data[key] = val;
        return this;
      }
    };
  });


  //
  // BlockFactory
  // Provide a copy of a pseudo-randomly selected block type
  //
  var BlockFactory = (function () {
    var
      blockStats    =  null,
      blockQueue    =  [],

      blockLayouts  =  [ // Array of all block layouts
        {
          type:  'O',
          layout:  [
            [false,  false,  false,  false],
            [false,  true,  true,  false],
            [false,  true,  true,  false],
            [false,  false,  false,  false]
          ]
        }, {
          type:  'I',
          layout:  [
            [false,  false,  false,  false],
            [false,  false,  false,  false],
            [true,  true,  true,  true],
            [false,  false,  false,  false]
          ]
        }, {
          type:  'Z',
          layout:  [
            [true,  true, false],
            [false,  true, true],
            [false,  false, false]
          ]
        }, {
          type:  'S',
          layout:  [
            [false,  true, true],
            [true,  true, false],
            [false,  false, false]
          ]
        }, {
          type:  'L',
          layout: [
            [true,  false, false],
            [true,  true, true],
            [false,  false, false]
          ]
        }, {
          type:  'J',
          layout:  [
            [false,  false, true],
            [true,  true, true],
            [false,  false, false]
          ]
        }, {
          type:  'T',
          layout:  [
            [false,  true, false],
            [true,  true, true],
            [false,  false, false]
          ]
        }
      ];


    function getRandIdx() {
      // Make sure blocks are chosen somewhat more fairly
      var
        minVal,
        minIdx;

      for (var i = 0; i < blockStats.length; i++) {
        var randVal =
            Math.floor(Math.random() * Math.pow(blockStats[i], 3)),
          randOffset = (Math.random() < 0.5) ? 0.5 : -0.5;
        if (!minVal || randVal + randOffset < minVal) {
          minVal = randVal;
          minIdx = i;
        }
      }
      blockStats[minIdx]++;

      return minIdx;
    }
    function pushBlock() {
      blockQueue.unshift(new Block(blockLayouts[getRandIdx()]));
    }

    // Initialize block stats
    blockStats = [];
    for (var i = 0; i < blockLayouts.length; i++) {
      blockStats[i] = 5;
    }

    // Set up blockQueue
    for (var j = 0; j < 3; j++) {
      pushBlock();
    }

    return {
      getQueue: function () {
        return blockQueue;
      },
      popBlock: function () {
        pushBlock();
        return blockQueue.pop();
      }
    };
  }) ();

  //
  // Game States
  // -  Each game state contains initialize() and render() functions.
  //

  var About = {
    handleKeys: function (evt) {
      if (evt.key === 'enter') {
        Tetris.set('newRender', 'Tetris.Menu');
      }
    },
    initialize: function () {},
    // Prerender whole frame
    prerender: function () {
      var ctx  =  Tetris.get('cacheCanvas').getContext('2d'),
        cH  =  ctx.canvas.height,
        cW  =  ctx.canvas.width;

      ctx.fillStyle = '#FFF';
      ctx.fillRect(0, 0, cW, cH);

      ctx.fillStyle = '#333';
      ctx.font = (cH * 0.18) + 'px ' + Tetris.settings.headerFont;
      ctx.fillText('Tetris.js', cW * 0.12, cH * 0.35);

      ctx.fillStyle = '#555';
      ctx.font = (cH * 0.05) + 'px ' + Tetris.settings.bodyFont;
      ctx.fillText('by andrewlo', cW * 0.25, cH * 0.45);
      ctx.fillText('version ' + Tetris.version, cW * 0.25, cH * 0.52);

      ctx.font = (cH * 0.035) + 'px ' + Tetris.settings.bodyFont;
      ctx.fillText('> press enter to get back to menu', cW * 0.2, cH * 0.65);
    },
    render: function () {
      var ctx = Tetris.get('canvas').getContext('2d');
      ctx.drawImage(Tetris.get('cacheCanvas'), 0, 0);
    },
    update: function () {}
  };
  Tetris.About = About;

  var GameOver = {
    handleKeys: function (evt) {
      if (evt.key === 'enter') {
        Tetris.set('newRender', 'Tetris.Menu');
      }
    },
    initialize: function () {},
    prerender: function () {
      var ctx = Tetris.get('cacheCanvas').getContext('2d');

      ctx.fillStyle = '#300';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      ctx.fillStyle = ctx.strokeStyle = '#FFF';
      ctx.fillRect(0, ctx.canvas.height * 0.35,
          ctx.canvas.width, ctx.canvas.height * 0.003);

      ctx.lineWidth = 3;
      ctx.font = (ctx.canvas.height * 0.12) + 'px ' +
          Tetris.settings.headerFont;
      ctx.fillText('GAME OVER', ctx.canvas.width * 0.1,
          ctx.canvas.height * 0.35);

      ctx.fillStyle = '#800';
      ctx.font = (ctx.canvas.height * 0.07) + 'px ' +
          Tetris.settings.bodyFont;
      ctx.fillText('PLAY AGAIN?', ctx.canvas.width * 0.2,
          ctx.canvas.height * 0.43);
    },
    render: function () {
      var ctx = Tetris.get('canvas').getContext('2d');
      ctx.drawImage(Tetris.get('cacheCanvas'), 0, 0);
    },
    update: function () {}
  };
  Tetris.GameOver = GameOver;

  // Main game state.
  var Main = (function () {
    var data = {
      changed:  true,
      currPiece:  null,

      stats: {
        fps: '-',
        frames: 0,
        timeStart: new Date().getTime()
      }
    };

    return {
      act: function () {
        if (!this.move({ y: 1 })) {
          var currPos = data.currPiece.get('pos');
          for (var a = 0, b = data.currPiece.get('layout'),
            c = b.length; a < c; a++) {
            for (var d = 0, e = b[a], f = e.length; d < f; d++) {
              if (b[a][d]) {
                data.board[currPos.y + a][currPos.x + d] = true;
              }
            }
          }
          data.changed = true;
          data.currPiece = null;
        }

        for (var i = 0; i < Tetris.settings.size.h; i++) {
          if (i < 2) {
            for (var j = 0, k = data.board[i], l = k.length;
              j < l; j++) {
              if (k[j]) {
                Tetris.set('newRender', 'Tetris.GameOver');
                return false;
              }
            }
          } else {
            var isFull = true;
            for (var p = 0, q = data.board[i], r = q.length;
              p < r; p++) {
              if (!q[p]) {
                isFull = false;
                break;
              }
            }
            if (isFull) {
              data.board.splice(i, 1);
              data.linesCompleted++;
            } else {
              continue;
            }

            var newRow = [];
            for (var s = 0; s < Tetris.settings.size.w; s++) {
              newRow[s] = false;
            }
            data.board.unshift(newRow);
            i--;
          }
        }
      },
      getGhostPos: function () {
        var
          c      =  0,
          pos      =  data.currPiece.get('pos'),
          validMove  =  true;

        while (validMove) {
          c++;

          for (var i = 0, j = data.currPiece.get('layout'),
              k = j.length; i < k; i++) {
            for (var p = 0, q = j[i], r = q.length; p < r; p++) {
              if (q[p] &&
                  (i + pos.y + c >= Tetris.settings.size.h ||
                  data.board[i + pos.y + c][p + pos.x])) {
                validMove = false;
                break;
              }
            }
            if (!validMove) {
              break;
            }
          }
        }
        c--;

        return c;
      },
      getStationaryCanvas: function () {
        // Draw block queue
        var
          blockQueue = BlockFactory.getQueue(),
          blockSize,
          stationaryCanvas = document.createElement('canvas'),
          ctx = stationaryCanvas.getContext('2d'),
          cW = ctx.canvas.width = Tetris.get('canvas').width,
          cH = ctx.canvas.height = Tetris.get('canvas').height,
          queueHeight = 1;

        blockSize = Math.min(0.96 * cH / (Tetris.settings.size.h - 2),
                0.56 * cW / Tetris.settings.size.w);

        ctx.fillStyle = '#333';
        for (var idx = blockQueue.length - 1; idx >= 0; idx--) {
          var
            blockLayout    =  blockQueue[idx].get('layout'),
            nonEmptyRows  =  0;

          for (var i = 0; i < blockLayout.length; i++) {
            var empty = true;
            for (var j = 0, k = blockLayout[i]; j < k.length; j++) {
              if (k[j]) {
                empty = false;
                break;
              }
            }

            if (empty) {
              continue;
            }
            nonEmptyRows++;

            for (var j = 0, k = blockLayout[i]; j < k.length; j++) {
              if (k[j]) {
                ctx.fillRect((cW * 0.4 - blockLayout.length *
                      blockSize) / 2 + blockSize * j,
                    cH * 0.2 + blockSize * queueHeight +
                      blockSize * nonEmptyRows,
                    blockSize, blockSize);
                if (Tetris.settings.imgBlock) {
                  ctx.drawImage(data.blockCache,
                    (cW * 0.4 - blockLayout.length *
                        blockSize) / 2 + blockSize * j,
                      cH * 0.2 + blockSize * queueHeight +
                        blockSize * nonEmptyRows,
                      blockSize, blockSize);
                }
              }
            }
          }

          queueHeight += nonEmptyRows + 1;
        }

        // Draw stationary blocks
        ctx.fillStyle = '#555';
        ctx.strokeStyle = '#FFF';
        for (var i = 0, j = data.board, k = j.length; i < k; i++) {
          for (var p = 0, q = j[i], r = q.length; p < r; p++) {
            if (q[p] && i - 2 >= 0) {
              ctx.fillRect(0.42 * cW + blockSize * p,
                0.02 * cH + blockSize * (i - 2),
                blockSize, blockSize);
              if (Tetris.settings.imgBlock) {
                ctx.drawImage(data.blockCache, 0.42 * cW + blockSize * p,
                    0.02 * cH + blockSize * (i - 2),
                    blockSize, blockSize);
              } else {
                ctx.strokeRect(0.42 * cW + blockSize * p,
                  0.02 * cH + blockSize * (i - 2),
                  blockSize, blockSize);
              }
            }
          }
        }

        return stationaryCanvas;
      },
      handleKeys: function(evt) {
        if (evt.code !== 27 && (data.paused || !data.currPiece)) {
          return;
        }

        switch (evt.code) {
          case 27: // esc
            this.pause(!data.paused);
            data.lastAct = new Date().getTime();
            break;
          case 32: // space
            while (this.move({ y: 1 }));

            this.act();
            data.lastAct = 0;

            break;
          case 37: // left
            if (this.move({ x: -1 })) {
              data.lastAct = new Date().getTime();
            }
            break;
          case 38: // up
            var newLayout = this.rotate();
            if (newLayout.canRot) {
              data.currPiece.set('layout', newLayout.layout);
              data.lastAct = new Date().getTime();
            }
            break;
          case 39: // right
            if (this.move({ x: 1 })) {
              data.lastAct = new Date().getTime();
            }
            break;
          case 40: // down
            this.move({ y: 1 });
            data.lastAct = new Date().getTime();
            break;
        }
      },
      initialize: function () {
        data.blockCache = document.createElement('canvas');
        data.blockCache.width =
          data.blockCache.height = Tetris.get('blockImg').width;
        data.blockCache.getContext('2d').drawImage(Tetris.get('blockImg'), 0, 0);

        data.board = [];
        data.lastAct = 0;
        data.linesCompleted = 0;
        data.paused = false;
        data.stationaryCache = null;


        for (var i = 0; i < Tetris.settings.size.h; i++) {
          data.board[i] = [];
          for (var j = 0; j < Tetris.settings.size.w; j++) {
            data.board[i][j] = false;
          }
        }
      },
      move: function (pos) {
        var canMove = true,
          currPos = data.currPiece.get('pos');

        pos.x = pos.x || 0;
        pos.y = pos.y || 0;
        for (var i = 0, j = data.currPiece.get('layout'), k = j.length;
            i < k; i++) {
          for (var p = 0, q = j[i], r = q.length; p < r; p++) {
            if (!q[p]) {
              continue;
            }
            if (currPos.y + i + pos.y >= Tetris.settings.size.h ||
              currPos.x + p + pos.x < 0 ||
              currPos.x + p + pos.x >= Tetris.settings.size.w ||
              data.board[currPos.y + i + pos.y]
                  [currPos.x + p + pos.x]) {
              canMove = false;
            }
          }
        }

        if (canMove) {
          data.currPiece.set('pos', { x: currPos.x + pos.x,
            y: currPos.y + pos.y });
        }

        return canMove;
      },
      pause: function (b) {
        data.paused = b;
      },
      prerender: function () {
        var
          blockSize,
          ctx      =  Tetris.get('cacheCanvas').getContext('2d'),
          cH = ctx.canvas.height,
          cW = ctx.canvas.width;

        blockSize = Math.min(0.96 * cH / (Tetris.settings.size.h - 2),
                0.56 * cW / Tetris.settings.size.w);

        // BG
        ctx.fillStyle = '#FFF';
        ctx.fillRect(0, 0, Math.round(cW), Math.round(cH));

        // Header
        ctx.fillStyle = '#555';
        ctx.font = cH  * 0.075 + 'px ' + Tetris.settings.headerFont;
        ctx.fillText('Tetris.js', cW * 0.04, cH * 0.125);

        ctx.fillStyle = '#EEE';
        ctx.fillRect(cW * 0.07, cH * 0.8, cW * 0.3, cH * 0.15);

        // Draw Block Queue
        ctx.fillStyle = '#FFF';
        ctx.fillRect(0.07 * cW, 0.22 * cH, cW * 0.3, cH * 0.53);
        ctx.strokeStyle = '#CCC';
        ctx.strokeRect(0.07 * cW, 0.22 * cH, cW * 0.3, cH * 0.53);

        ctx.fillStyle = '#888';
        ctx.font = 0.04 * cH + 'px ' + Tetris.settings.headerFont;
        ctx.fillText('Next:', 0.09 * cW, 0.22 * cH - 2);

        // Draw game board
        ctx.fillStyle = '#FFF';
        ctx.fillRect(0.42 * cW, 0.02 * cH,
            blockSize * Tetris.settings.size.w, 0.96 * cH);

        ctx.strokeStyle = '#AAA';
        ctx.strokeRect((0.42 * cW) - 2,
            0.02 * cH - 2,
            blockSize * Tetris.settings.size.w + 4,
            0.96 * cH + 4);
      },
      render: function () {
        var
          blockSize,
          ctx      =  Tetris.get('canvas').getContext('2d'),
          cH = ctx.canvas.height,
          cW = ctx.canvas.width;

        blockSize = Math.min(0.96 * cH / (Tetris.settings.size.h - 2),
                0.56 * cW / Tetris.settings.size.w);

        data.stats.frames++;
        if ((new Date()).getTime() - data.stats.timeStart > 2000) {
          data.stats.fps = Math.round(data.stats.frames /
            (new Date().getTime() - data.stats.timeStart) * 1000);
          data.stats.frames = 0;
          data.stats.timeStart = new Date().getTime();
        }

        ctx.drawImage(Tetris.get('cacheCanvas'), 0, 0);

        ctx.fillStyle = '#555';
        ctx.font = cH * 0.03 + 'px ' + Tetris.settings.bodyFont;
        ctx.fillText('lines cleared: ' + data.linesCompleted,
            cW * 0.1, cH * 0.86);

        ctx.fillText('frames/sec: ' + data.stats.fps,
            cW * 0.1, cH * 0.91);

        if (!data.stationaryCache || data.changed ||
            ctx.canvas.width !== data.stationaryCache.width) {
          data.changed = false;
          data.stationaryCache = this.getStationaryCanvas();
        }
        ctx.drawImage(data.stationaryCache, 0, 0);

        if (data.currPiece) {
          var
            g  =  this.getGhostPos(),
            x  =  data.currPiece.get('pos').x,
            y  =  data.currPiece.get('pos').y;

          // Draw ghost
          if (Tetris.settings.ghost) {
            ctx.fillStyle = '#DDD';
            for (var i = 0, j = data.currPiece.get('layout'),
                k = j.length; i < k; i++) {
              for (var p = 0, q = j[i], r = q.length; p < r;
                  p++) {
                if (y + i + g - 2 >= 0 && q[p]) {
                  ctx.fillRect(0.42 * cW + blockSize * (x + p),
                    0.02 * cH + blockSize * (y + i + g - 2),
                    blockSize, blockSize);

                  if (Tetris.settings.imgBlock) {
                    ctx.drawImage(data.blockCache,
                      0.42 * cW + blockSize * (x + p),
                      0.02 * cH + blockSize *
                        (y + i + g - 2),
                      blockSize, blockSize);
                  }
                }
              }
            }
          }

          // Draw piece
          ctx.fillStyle = 'orange';
          ctx.strokeStyle = '#FFF';
          for (var i = 0, j = data.currPiece.get('layout'),
              k = j.length; i < k; i++) {
            for (var p = 0, q = j[i], r = q.length; p < r; p++) {
              if (y + i - 2 >= 0 && q[p]) {
                ctx.fillRect(0.42 * cW + blockSize * (x + p),
                    0.02 * cH + blockSize * (y + i - 2),
                    blockSize, blockSize);

                if (Tetris.settings.imgBlock) {
                  ctx.drawImage(data.blockCache,
                      0.42 * cW + blockSize * (x + p),
                      0.02 * cH + blockSize * (y + i - 2),
                      blockSize, blockSize);
                } else {
                  ctx.strokeRect(0.42 * cW +
                      blockSize * (x + p),
                      0.02 * cH + blockSize * (y + i - 2),
                      blockSize, blockSize);
                }
              }
            }
          }
        }

        // Draw PAUSED message
        if (data.paused) {
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#CCC';
          ctx.strokeRect(0, 0.27 * cH, cW, cH * 0.18);

          ctx.fillStyle = '#CCC';
          ctx.fillRect(0, 0.28 * cH, cW, cH * 0.16);

          ctx.fillStyle = '#555';
          ctx.font = (0.1 * cH) + 'px ' + Tetris.settings.headerFont;
          ctx.fillText('PAUSED', 0.25 * cW, 0.4 * cH);
        }
      },
      // Rotate active block
      rotate: function () {
        var
          blockPos  =  data.currPiece.get('pos'),
          canRot    =  true,
          piece    =  data.currPiece.get('layout'),
          rotPiece  =  [];

        for (var i = 0; i < piece.length; i++) {
          rotPiece[i] = [];
          for (var j = 0; j < piece[i].length; j++) {
            rotPiece[i][j] = piece[piece.length - j - 1][i];

            // Check for valid dims
            if (rotPiece[i][j] &&
                (blockPos.x + j < 0 ||
                blockPos.x + j >= Tetris.settings.size.w ||
                blockPos.y + i >= Tetris.settings.size.h)) {
              canRot = false;
            }
            // Check for overlap
            if (rotPiece[i][j] &&
                data.board[blockPos.y + i][blockPos.x + j]) {
              canRot = false;
            }
          }
        }

        return {
          layout:  rotPiece,
          canRot:  canRot
        };
      },
      update: function () {
        var currTime = new Date().getTime();

        if (!data.paused && data.lastAct +
            Tetris.settings.speed < currTime) {
          if (data.currPiece) {
            this.act();
          } else {
            data.currPiece = BlockFactory.popBlock();
          }

          data.lastAct = currTime;
        }
      }
    };
  }) ();
  Tetris.Main = Main;

  var Menu = (function () {
    var data = {
      options: {
        start: 'Tetris.Main',
        options: 'Tetris.Options',
        about: 'Tetris.About'
      },
      menu: null,
      selIdx: 0
    };

    return {
      initialize: function () {
        data.menu = [];
        for (var option in data.options) {
          if (data.options.hasOwnProperty(option)) {
            data.menu.push(option);
          }
        }
      },
      handleKeys: function (evt) {
        if (evt.key === 'up' && data.selIdx > 0) {
          data.selIdx--;
        } else if (evt.key === 'down' &&
            data.selIdx < data.menu.length - 1) {
          data.selIdx++;
        } else if (evt.key === 'enter') {
          Tetris.set('newRender',
              data.options[data.menu[data.selIdx]]);
        }
      },
      prerender: function () {
        var
          ctx = Tetris.get('cacheCanvas').getContext('2d'),
          cH = ctx.canvas.height,
          cW = ctx.canvas.width;

        ctx.fillStyle = '#FFF';
        ctx.fillRect(0, 0, cW, cH);

        ctx.fillStyle = '#333';
        ctx.font = (cH * 0.18) + 'px ' + Tetris.settings.headerFont;
        ctx.fillText('Tetris.js', cW * 0.12, cH * 0.35);
      },
      render: function () {
        var
          ctx = Tetris.get('canvas').getContext('2d'),
          cH = ctx.canvas.height,
          cW = ctx.canvas.width;

        ctx.drawImage(Tetris.get('cacheCanvas'), 0, 0);
        ctx.fillStyle = '#CCC';
        ctx.fillRect(cW * 0.30, cH * (0.42 + 0.1 * data.selIdx),
            cW * 0.5, cH * 0.1);

        ctx.fillStyle = '#555';
        ctx.font = (cH * 0.06) + 'px ' + Tetris.settings.bodyFont;
        for (var i = 0; i < data.menu.length; i++) {
          ctx.fillText(data.menu[i], cW * 0.35, cH * 0.49 + cH * 0.1 * i);
        }
      },
      update: function () {}
    };
  }) ();
  Tetris.Menu = Menu;

  var Options = (function () {
    var
      data = {
        options: {
          'ghost': {
            label: 'Ghost',
            values: {
              'On': true,
              'Off': false
            }
          },
          'imgBlock': {
            label: 'Use SVG',
            values: {
              'Yes': true,
              'No': false
            }
          },
          'speed': {
            label: 'Speed',
            values: {
              'Slow': 500,
              'Norm': 250,
              'Fast': 100
            }
          }
        },
        selIdx: 0
      };
    return {
      handleKeys: function (evt) {
        var offset = true;
        switch (evt.code) {
          case 13: // enter
            Tetris.set('newRender', 'Tetris.Menu');
            break;
          case 37: // left
            offset = false;
          case 39: // right
            var
              optName  =  Object.keys(data.options)[data.selIdx],
              optVal  =  data.options[optName];

            for (var idx = 0, vals = Object.values(optVal.values);
                idx < vals.length; idx++) {
              if (vals[idx] === Tetris.settings[optName]) {
                if (!offset && idx > 0) {
                  Tetris.settings[optName] = vals[idx - 1];
                } else if (offset && idx < vals.length - 1) {
                  Tetris.settings[optName] = vals[idx + 1];
                }
                break;
              }
            }
            break;
          case 38: // up
            if (data.selIdx > 0) {
              data.selIdx--;
            }
            break;
          case 40: // down
            if (data.selIdx < Object.keys(data.options).length - 1) {
              data.selIdx++;
            }
            break;
        }
      },
      initialize: function () {},
      prerender: function () {},
      render: function () {
        var
          ctx      =  Tetris.get('canvas').getContext('2d'),
          cH       =  ctx.canvas.height,
          cW       =  ctx.canvas.width,
          optCount =  0;

        ctx.fillStyle = '#FFF';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.strokeStyle = '#CCC';
        ctx.strokeRect(0.1 * cW, 0.2 * cH, cW * 0.8, cH * 0.7);

        ctx.fillStyle = '#555';
        ctx.font = (0.09 * cH) + 'px ' + Tetris.settings.headerFont;
        ctx.fillText('Options', cW * 0.12, cH * 0.19);

        for (var option in data.options) {
          if (data.options.hasOwnProperty(option)) {
            var
              thisOption = data.options[option],
              valCount = 0;

            ctx.fillStyle = '#555';
            ctx.font = 'bold ' + (0.05 * cH)  + 'px ' +
                Tetris.settings.bodyFont;
            ctx.fillText(thisOption.label + ':',
                cW * 0.15, cH * 0.3 + optCount * cH * 0.08);

            for (var val in thisOption.values) {
              if (thisOption.values.hasOwnProperty(val)) {
                var thisValue = thisOption.values[val];

                //ctx.lineWidth = (data.selIdx === optCount) ?
                //    5 : 1;
                //ctx.strokeStyle = '#CCC';
                ctx.fillStyle = (data.selIdx === optCount) ? '#555' : '#888';
                if (Tetris.settings[option] === thisValue) {
                  //ctx.strokeRect(0.45 * cW +
                  ctx.fillRect(0.45 * cW + 0.15 * cW * valCount - 2,
                    cH * 0.335 + (optCount - 1) * cH * 0.08 - 1,
                    0.14 * cW + 4, 0.05 * cH + 2);
                }

                ctx.fillStyle = (Tetris.settings[option] === thisValue)
                  ? '#EEE' : '#888';
                ctx.font = (0.05 * cH)  + 'px ' +
                    Tetris.settings.bodyFont;
                ctx.fillText(val, 0.45 * cW + 0.15 * cW * valCount,
                    cH * 0.3 + optCount * cH * 0.08);

                valCount++;
              }
            }

            optCount++;
          }
        }
      },
      update: function () {}
    };
  }) ();
  Tetris.Options = Options;

}) (this);

