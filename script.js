        const canvas = document.getElementById('mapCanvas');
        const ctx = canvas.getContext('2d');
        let lastTime = performance.now();

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            draw();
        });


        let camera = { x: 0, y: 0, zoom: 0.8, isDragging: false, startX: 0, startY: 0, hasDragged: false };
        let nodes = []; 
        let edges = []; 
        let bundaranList = [];  
        let rukoComplexes = []; 
        let gangRoads = [];     
        let vegetation = [];    

        const KOTA_COLOR = {
            tanahRumput: "#27ae60",   
            aspal: "#1e2124",         
            trotoarPaving: "#718093", 
            markaPutih: "#ffffff",
            batangPohon: "#5c3d31",
            daunPohonTua: "#1b4d3e",
            daunPohonMuda: "#2ecc71"
        };

        const SKALA_GEO = 0.00001; 
        const LAT_KOTA_ASAL = -0.9205; 
        const LON_KOTA_ASAL = 104.4750;

        let navigation = {
            startPos: null, endPos: null, isActive: false,
            waypoints: [], currentWp: 0, objX: 0, objY: 0, objAngle: 0,
            baseSpeed: 3.5, objectType: 'mobil'
        };

        function sqr(x) { return x * x }
        function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
        function distToSegmentSquared(p, v, w) {
            let l2 = dist2(v, w);
            if (l2 == 0) return dist2(p, v);
            let t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
            return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
        }
        function distToSegment(p, v, w) { return Math.sqrt(distToSegmentSquared(p, v, w)); }

        function hitungHaversine(x1, y1, x2, y2) {
            const R = 6371000; 
            let lat1 = LAT_KOTA_ASAL + y1 * SKALA_GEO; let lon1 = LON_KOTA_ASAL + x1 * SKALA_GEO;
            let lat2 = LAT_KOTA_ASAL + y2 * SKALA_GEO; let lon2 = LON_KOTA_ASAL + x2 * SKALA_GEO;
            let dLat = (lat2 - lat1) * Math.PI / 180; let dLon = (lon2 - lon1) * Math.PI / 180;
            let a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
            return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
        }

        function getCubicBezierPoint(p0, p1, p2, p3, t) {
            let mt = 1 - t;
            return {
                x: mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x,
                y: mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y
            };
        }

        function getBezierTangentAngle(p0, p1, p2, p3, t) {
            let mt = 1 - t;
            let dx = 3*mt*mt*(p1.x - p0.x) + 6*mt*t*(p2.x - p1.x) + 3*t*t*(p3.x - p2.x);
            let dy = 3*mt*mt*(p1.y - p0.y) + 6*mt*t*(p2.y - p1.y) + 3*t*t*(p3.y - p2.y);
            if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return 0;
            return Math.atan2(dy, dx);
        }

        function isPosisiSangatAman(cx, cy, wBldg, hTotal, sisiAngle, tipe) {
            if (cx < 40 || cx > 1460 || cy < 40 || cy > 960) return false;

            for (let b of bundaranList) {
                if (Math.hypot(cx - b.x, cy - b.y) < (b.radiusLuar + 75)) return false;
            }

            if (tipe === 'pohon') {
                for (let edge of edges) {
                    for (let t = 0; t <= 1; t += 0.04) {
                        let roadPt = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], t);
                        if (Math.hypot(cx - roadPt.x, cy - roadPt.y) < 18) return false;
                    }
                }
                for (let gang of gangRoads) {
                    if (distToSegment({x: cx, y: cy}, {x: gang.x1, y: gang.y1}, {x: gang.x2, y: gang.y2}) < 10) return false;
                }
                for (let ruko of rukoComplexes) {
                    if (Math.hypot(cx - ruko.x, cy - ruko.y) < (ruko.rBldg + 5)) return false;
                }
                return true;
            }

            let radiusAmanBldg = Math.hypot(wBldg, hTotal);

            for (let ruko of rukoComplexes) {
                let jarakMinimalAman = ruko.rBldg + radiusAmanBldg + 6; 
                if (Math.hypot(cx - ruko.x, cy - ruko.y) < jarakMinimalAman) return false;
            }

            let alpha = sisiAngle + Math.PI / 2;
            let cosA = Math.cos(alpha);
            let sinA = Math.sin(alpha);
            
            let petaSudut = [
                {x: 0, y: 0}, 
                {x: -wBldg, y: 0}, {x: wBldg, y: 0},
                {x: -wBldg, y: -hTotal}, {x: wBldg, y: -hTotal}
            ];

            for (let pt of petaSudut) {
                let wx = cx + (pt.x * cosA - pt.y * sinA);
                let wy = cy + (pt.x * sinA + pt.y * cosA);

                for (let edge of edges) {
                    for (let t = 0; t <= 1; t += 0.03) {
                        let roadPt = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], t);
                        if (Math.hypot(wx - roadPt.x, wy - roadPt.y) < 15) return false; 
                    }
                }

                for (let gang of gangRoads) {
                    if (distToSegment({x: wx, y: wy}, {x: gang.x1, y: gang.y1}, {x: gang.x2, y: gang.y2}) < 8) return false;
                }
            }

            return true;
        }

        function isJalurGangAman(x1, y1, x2, y2) {
            if (x2 < 50 || x2 > 1450 || y2 < 50 || y2 > 950) return false;

            for (let b of bundaranList) {
                if (Math.hypot(x2 - b.x, y2 - b.y) < b.radiusLuar + 30) return false;
            }

            let midX = (x1 + x2) / 2;
            let midY = (y1 + y2) / 2;

            for (let edge of edges) {
                for (let t = 0; t <= 1; t += 0.05) {
                    let roadPt = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], t);
                    if (Math.hypot(x2 - roadPt.x, y2 - roadPt.y) < 45) return false;
                    if (Math.hypot(midX - roadPt.x, midY - roadPt.y) < 25) return false;
                }
            }
            return true;
        }

        function isDiDalamBundaran(x, y) {
            for (let b of bundaranList) {
                if (Math.hypot(x - b.x, y - b.y) < b.radiusLuar) return true;
            }
            return false;
        }

        function generateCityMap() {
            nodes = []; edges = []; bundaranList = []; rukoComplexes = []; vegetation = []; gangRoads = [];
            resetNavigation();

            nodes.push({ id: 0, x: 150 + Math.random() * 80,   y: 150 + Math.random() * 80 });
            nodes.push({ id: 1, x: 650 + Math.random() * 100,  y: 120 + Math.random() * 80 });
            nodes.push({ id: 2, x: 1150 + Math.random() * 80,  y: 150 + Math.random() * 80 });
            nodes.push({ id: 3, x: 1200 + Math.random() * 80,  y: 600 + Math.random() * 100 });
            nodes.push({ id: 4, x: 750 + Math.random() * 100,  y: 820 + Math.random() * 80 });
            nodes.push({ id: 5, x: 250 + Math.random() * 100,  y: 780 + Math.random() * 80 });
            nodes.push({ id: 6, x: 120 + Math.random() * 80,   y: 450 + Math.random() * 100 });
            nodes.push({ id: 7, x: 450 + Math.random() * 80,   y: 420 + Math.random() * 80 });
            nodes.push({ id: 8, x: 880 + Math.random() * 80,   y: 450 + Math.random() * 80 });

            buatRuasJalan(0, 1); buatRuasJalan(1, 2); buatRuasJalan(2, 3);
            buatRuasJalan(3, 4); buatRuasJalan(4, 5); buatRuasJalan(5, 6); buatRuasJalan(6, 0);
            buatRuasJalan(0, 7); buatRuasJalan(1, 7); buatRuasJalan(7, 8); 
            buatRuasJalan(8, 2); buatRuasJalan(8, 3); buatRuasJalan(7, 5); buatRuasJalan(8, 4);

            nodes.forEach(node => {
                let cabangJalan = edges.filter(e => e.from === node.id || e.to === node.id).length;
                if (cabangJalan >= 3) bundaranList.push({ id: node.id, x: node.x, y: node.y, radiusLuar: 38, radiusTaman: 18 });
            });

            edges.forEach(edge => { edge.length = hitungPanjangEdge(edge); });

            edges.forEach((edge) => {
                for (let t = 0.20; t <= 0.80; t += 0.22) { 
                    let ptJalan = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], t);
                    let ptNext = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], t + 0.01);
                    let angle = Math.atan2(ptNext.y - ptJalan.y, ptNext.x - ptJalan.x);

                    const sides = [angle + Math.PI / 2, angle - Math.PI / 2];
                    sides.forEach(sisiAngle => {
                        if (Math.random() > 0.2) { 
                            let gangLength = 90 + Math.random() * 40; 
                            let gangEndX = ptJalan.x + Math.cos(sisiAngle) * gangLength;
                            let gangEndY = ptJalan.y + Math.sin(sisiAngle) * gangLength;

                            if (isJalurGangAman(ptJalan.x, ptJalan.y, gangEndX, gangEndY)) {
                                gangRoads.push({ x1: ptJalan.x, y1: ptJalan.y, x2: gangEndX, y2: gangEndY });

                                for (let d = 24; d <= gangLength - 15; d += 24) {
                                    let ptGang = { x: ptJalan.x + Math.cos(sisiAngle) * d, y: ptJalan.y + Math.sin(sisiAngle) * d };
                                    const gangSides = [sisiAngle + Math.PI / 2, sisiAngle - Math.PI / 2];
                                    
                                    gangSides.forEach(gSide => {
                                        let wBldg = 11 + Math.random() * 3; 
                                        let hBldg = 12 + Math.random() * 3;
                                        let cx = ptGang.x + Math.cos(gSide) * 16;
                                        let cy = ptGang.y + Math.sin(gSide) * 16;

                                        if (isPosisiSangatAman(cx, cy, wBldg, hBldg, gSide, 'rumah')) {
                                            rukoComplexes.push({
                                                x: cx, y: cy,
                                                ptHubungJalan: ptGang, 
                                                isGangHouse: true,     
                                                angle: sisiAngle, sisi: gSide,
                                                hasParking: false,
                                                wRuko: wBldg, hRuko: hBldg,
                                                wParkir: wBldg + 2, hParkir: 0,
                                                rBldg: Math.hypot(wBldg, hBldg),
                                                kendaraanParkir: []
                                            });
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
            });

            edges.forEach((edge) => {
                for (let t = 0.05; t <= 0.95; t += 0.06) { 
                    let ptJalan = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], t);
                    let ptNext = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], Math.min(t + 0.01, 1));
                    let angle = Math.atan2(ptNext.y - ptJalan.y, ptNext.x - ptJalan.x);
                    
                    const sides = [angle + Math.PI / 2, angle - Math.PI / 2];
                    sides.forEach(sisiAngle => {
                        let hasParking = Math.random() > 0.4; 
                        let wBldg = 14 + Math.random() * 4; 
                        let hBldg = 14 + Math.random() * 4;
                        let hParkir = hasParking ? 16 : 0;

                        let offsetJarak = hasParking ? 43 : 26;
                        let cx = ptJalan.x + Math.cos(sisiAngle) * offsetJarak;
                        let cy = ptJalan.y + Math.sin(sisiAngle) * offsetJarak;

                        if (isPosisiSangatAman(cx, cy, wBldg, hBldg + hParkir, sisiAngle, 'ruko')) {
                            let parkirDaftar = [];
                            if (hasParking) {
                                for (let i = 0; i < 2; i++) {
                                    if (Math.random() > 0.4) {
                                        parkirDaftar.push({ slotIdx: i, tipe: Math.random() > 0.4 ? 'mobil' : 'motor', warna: ['#e74c3c', '#3498db', '#ffffff', '#f1c40f'][Math.floor(Math.random() * 4)] });
                                    }
                                }
                            }

                            rukoComplexes.push({ 
                                x: cx, y: cy, 
                                ptHubungJalan: ptJalan, 
                                angle: angle, sisi: sisiAngle, 
                                isGangHouse: false, hasParking: hasParking,
                                wRuko: wBldg, hRuko: hBldg, 
                                wParkir: wBldg + 3, hParkir: hParkir, 
                                rBldg: Math.hypot(wBldg, hBldg + hParkir),
                                kendaraanParkir: parkirDaftar 
                            });
                        }
                    });
                }
            });

            let percobaanPohon = 300; 
            while (vegetation.length < 120 && percobaanPohon > 0) {
                let px = Math.random() * 1500; let py = Math.random() * 1000; let rPohon = 6 + Math.random() * 5; 
                if (isPosisiSangatAman(px, py, rPohon, rPohon, 0, 'pohon')) vegetation.push({ x: px, y: py, radius: rPohon });
                percobaanPohon--;
            }
            draw();
        }

        function buatRuasJalan(fromId, toId) {
            let pStart = nodes[fromId]; let pEnd = nodes[toId]; let dx = pEnd.x - pStart.x; let dy = pEnd.y - pStart.y;
            let ctrl1 = { x: pStart.x + dx * 0.35 + (Math.random() - 0.5) * 30, y: pStart.y + dy * 0.15 + (Math.random() - 0.5) * 30 };
            let ctrl2 = { x: pStart.x + dx * 0.65 + (Math.random() - 0.5) * 30, y: pStart.y + dy * 0.85 + (Math.random() - 0.5) * 30 };
            edges.push({ from: fromId, to: toId, ctrl1: ctrl1, ctrl2: ctrl2, length: 0 });
        }

        function resetNavigation() {
            navigation.startPos = null; navigation.endPos = null; navigation.isActive = false;
            navigation.waypoints = []; navigation.currentWp = 0;
            document.getElementById('status-val').innerText = "Pilih Titik Start";
            document.getElementById('jarak-val').innerText = "0";
            document.getElementById('btn-start-pause').innerText = " MULAI ";
            document.getElementById('btn-start-pause').classList.remove('paused');
        }

        function hitungPanjangEdge(edge) {
            let totalLength = 0; let pPrev = nodes[edge.from];
            for (let i = 1; i <= 100; i++) {
                let pt = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], i / 100);
                totalLength += Math.hypot(pt.x - pPrev.x, pt.y - pPrev.y); pPrev = pt;
            }
            return totalLength;
        }

        function dapatkanTitikTerdekatJalan(mx, my) {
            let jarakTerpendek = Infinity; let hasilKandidat = null;
            edges.forEach((edge, edgeIdx) => {
                for (let t = 0; t <= 1; t += 0.005) {
                    let pt = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], t);
                    let jarak = Math.hypot(mx - pt.x, my - pt.y);
                    if (jarak < jarakTerpendek && jarak < 45) { jarakTerpendek = jarak; hasilKandidat = { x: pt.x, y: pt.y, edgeIndex: edgeIdx, t: t }; }
                }
            });
            return hasilKandidat;
        }

        function generateWaypointsFromPath(rawPath) {
            let waypoints = []; let rawSegments = [];

            for (let seg of rawPath) {
                let edge = edges[seg.index]; let pts = []; let steps = 150;
                let minT = 0, maxT = 1;
                if (seg.index === navigation.startPos.edgeIndex) { if (seg.direction === 'forward') minT = navigation.startPos.t; else maxT = navigation.startPos.t; }
                if (seg.index === navigation.endPos.edgeIndex) { if (seg.direction === 'forward') maxT = navigation.endPos.t; else minT = navigation.endPos.t; }

                let startStep = (seg.direction === 'forward') ? Math.floor(minT * steps) : Math.floor(maxT * steps);
                let endStep = (seg.direction === 'forward') ? Math.floor(maxT * steps) : Math.floor(minT * steps);
                let stepInc = (seg.direction === 'forward') ? 1 : -1;

                for (let i = startStep; (stepInc > 0 ? i <= endStep : i >= endStep); i += stepInc) {
                    let t = i / steps; let pt = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], t);
                    let lookT = t + (seg.direction === 'forward' ? 0.005 : -0.005);
                    if (lookT > 1) lookT = 1; if (lookT < 0) lookT = 0;
                    let ptLook = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], lookT);
                    let angle = Math.atan2(ptLook.y - pt.y, ptLook.x - pt.x);
                    
                    let lajurOffset = 6.5; 
                    let offsetAngle = (seg.direction === 'forward') ? angle + Math.PI/2 : angle - Math.PI/2;
                    
                    let cx = pt.x + Math.cos(offsetAngle) * lajurOffset;
                    let cy = pt.y + Math.sin(offsetAngle) * lajurOffset;
                    pts.push({ x: cx, y: cy, angle: angle, rawX: pt.x, rawY: pt.y });
                }
                rawSegments.push({ edgeIdx: seg.index, dir: seg.direction, pts: pts });
            }

            for (let i = 0; i < rawSegments.length; i++) {
                let curSeg = rawSegments[i]; let nextSeg = (i < rawSegments.length - 1) ? rawSegments[i+1] : null;
                let curEdge = edges[curSeg.edgeIdx]; let endNodeId = (curSeg.dir === 'forward') ? curEdge.to : curEdge.from;
                let bTarget = bundaranList.find(b => b.id === endNodeId);
                let exitWpIndex = curSeg.pts.length - 1;
                
                if (bTarget && nextSeg) {
                    let rBatasAspalLuar = bTarget.radiusLuar + 2; 
                    for (let j = 0; j < curSeg.pts.length; j++) {
                        if (Math.hypot(curSeg.pts[j].rawX - bTarget.x, curSeg.pts[j].rawY - bTarget.y) <= rBatasAspalLuar) { exitWpIndex = Math.max(0, j - 1); break; }
                    }
                }

                for (let j = 0; j <= exitWpIndex; j++) waypoints.push(curSeg.pts[j]);

                if (bTarget && nextSeg) {
                    let entryWpIndex = 0; let rBatasAspalLuar = bTarget.radiusLuar + 2;
                    for (let j = 0; j < nextSeg.pts.length; j++) {
                        if (Math.hypot(nextSeg.pts[j].rawX - bTarget.x, nextSeg.pts[j].rawY - bTarget.y) > rBatasAspalLuar) { entryWpIndex = j; break; }
                    }
                    let pStart = waypoints[waypoints.length - 1]; let pEnd = nextSeg.pts[entryWpIndex];

                    if (pStart && pEnd) {
                        let angleStart = Math.atan2(pStart.y - bTarget.y, pStart.x - bTarget.x);
                        let angleEnd = Math.atan2(pEnd.y - bTarget.y, pEnd.x - bTarget.x);
                        
                        while (angleEnd < angleStart) angleEnd += Math.PI * 2;

                        let radiusLajur = bTarget.radiusLuar - 12; 
                        let arcSteps = Math.max(5, Math.ceil((angleEnd - angleStart) * radiusLajur / 3));

                        for (let s = 1; s < arcSteps; s++) {
                            let currAng = angleStart + (angleEnd - angleStart) * (s / arcSteps);
                            waypoints.push({ x: bTarget.x + Math.cos(currAng)*radiusLajur, y: bTarget.y + Math.sin(currAng)*radiusLajur, angle: currAng + Math.PI/2 });
                        }
                    }
                    nextSeg.pts = nextSeg.pts.slice(entryWpIndex);
                }
            }
            return waypoints;
        }

        function hitungRuteNavigasi(startEdgeIdx, endEdgeIdx) {
            let eStart = edges[startEdgeIdx]; let eEnd = edges[endEdgeIdx]; let rawPath = null;
            if (startEdgeIdx === endEdgeIdx) {
                rawPath = [{ index: startEdgeIdx, direction: (navigation.startPos.t <= navigation.endPos.t) ? 'forward' : 'backward' }];
            } else {
                let queue = [{ node: eStart.to, path: [{ index: startEdgeIdx, direction: 'forward' }] }, { node: eStart.from, path: [{ index: startEdgeIdx, direction: 'backward' }] }];
                let visited = new Set([eStart.from, eStart.to]);
                while (queue.length > 0) {
                    let { node, path } = queue.shift();
                    if (node === eEnd.from) { path.push({ index: endEdgeIdx, direction: 'forward' }); rawPath = path; break; }
                    if (node === eEnd.to) { path.push({ index: endEdgeIdx, direction: 'backward' }); rawPath = path; break; }
                    edges.forEach((edge, idx) => {
                        if (edge.from === node && !visited.has(edge.to)) { visited.add(edge.to); queue.push({ node: edge.to, path: [...path, { index: idx, direction: 'forward' }] }); }
                        if (edge.to === node && !visited.has(edge.from)) { visited.add(edge.from); queue.push({ node: edge.from, path: [...path, { index: idx, direction: 'backward' }] }); }
                    });
                }
            }
            if (!rawPath) rawPath = [{ index: startEdgeIdx, direction: 'forward' }];
            navigation.waypoints = generateWaypointsFromPath(rawPath);
            navigation.currentWp = 0;
        }

        function updateSimulation(dt) {
            if (!navigation.isActive || !navigation.waypoints || navigation.waypoints.length === 0) return;

            if (navigation.currentWp >= navigation.waypoints.length - 1) {
                navigation.isActive = false;
                document.getElementById('status-val').innerText = "Tiba di Tujuan 🏁";
                document.getElementById('btn-start-pause').innerText = "MULAI";
                document.getElementById('btn-start-pause').classList.remove('paused');
                return;
            }

            let wp = navigation.waypoints[navigation.currentWp];
            let nextWp = navigation.waypoints[Math.min(navigation.currentWp + 1, navigation.waypoints.length - 1)];

            let dtMultiplier = dt / 16.67;
            let speedPixels = navigation.baseSpeed * dtMultiplier;
            
            if (navigation.objectType === 'sepeda') speedPixels *= 0.5;
            if (Math.abs(wp.angle - nextWp.angle) > 0.05) speedPixels *= 0.55; 

            let dx = nextWp.x - navigation.objX; let dy = nextWp.y - navigation.objY; let dist = Math.hypot(dx, dy);

            if (dist <= speedPixels) {
                navigation.objX = nextWp.x; navigation.objY = nextWp.y; navigation.objAngle = nextWp.angle;
                navigation.currentWp++;
            } else {
                navigation.objX += (dx / dist) * speedPixels; navigation.objY += (dy / dist) * speedPixels;
                let diff = nextWp.angle - navigation.objAngle;
                while (diff < -Math.PI) diff += Math.PI * 2; while (diff > Math.PI) diff -= Math.PI * 2;
                navigation.objAngle += diff * 0.15 * dtMultiplier; 
            }

            let targetCamX = (canvas.width / 2) - navigation.objX;
            let targetCamY = (canvas.height / 2) - navigation.objY;
            
            camera.x += (targetCamX - camera.x) * Math.min(1, 0.08 * dtMultiplier);
            camera.y += (targetCamY - camera.y) * Math.min(1, 0.08 * dtMultiplier);
        }

        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2); ctx.scale(camera.zoom, camera.zoom);
            ctx.translate(-canvas.width / 2 + camera.x, -canvas.height / 2 + camera.y);
            ctx.fillStyle = KOTA_COLOR.tanahRumput; ctx.fillRect(-3000, -3000, 8000, 8000);
            ctx.strokeStyle = "#4b5563"; ctx.lineWidth = 42; ctx.lineJoin = "round"; ctx.lineCap = "round";
            edges.forEach(edge => { ctx.beginPath(); ctx.moveTo(nodes[edge.from].x, nodes[edge.from].y); ctx.bezierCurveTo(edge.ctrl1.x, edge.ctrl1.y, edge.ctrl2.x, edge.ctrl2.y, nodes[edge.to].x, nodes[edge.to].y); ctx.stroke(); });
            bundaranList.forEach(b => { ctx.fillStyle = "#4b5563"; ctx.beginPath(); ctx.arc(b.x, b.y, b.radiusLuar + 2, 0, Math.PI * 2); ctx.fill(); });
            ctx.save();
            ctx.strokeStyle = KOTA_COLOR.aspal; ctx.lineWidth = 14; ctx.lineCap = "round"; ctx.lineJoin = "round";
            gangRoads.forEach(gang => { ctx.beginPath(); ctx.moveTo(gang.x1, gang.y1); ctx.lineTo(gang.x2, gang.y2); ctx.stroke(); });
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = KOTA_COLOR.aspal; ctx.lineWidth = 8; ctx.lineCap = "round";
            rukoComplexes.forEach(comp => {
                if (comp.isGangHouse) { ctx.beginPath(); ctx.moveTo(comp.ptHubungJalan.x, comp.ptHubungJalan.y); ctx.lineTo(comp.x, comp.y); ctx.stroke(); }
            });
            ctx.restore();

            ctx.strokeStyle = KOTA_COLOR.aspal; ctx.lineWidth = 28; ctx.lineJoin = "round"; ctx.lineCap = "round";
            edges.forEach(edge => { ctx.beginPath(); ctx.moveTo(nodes[edge.from].x, nodes[edge.from].y); ctx.bezierCurveTo(edge.ctrl1.x, edge.ctrl1.y, edge.ctrl2.x, edge.ctrl2.y, nodes[edge.to].x, nodes[edge.to].y); ctx.stroke(); });
            bundaranList.forEach(b => { ctx.fillStyle = KOTA_COLOR.aspal; ctx.beginPath(); ctx.arc(b.x, b.y, b.radiusLuar - 2, 0, Math.PI * 2); ctx.fill(); });
            ctx.strokeStyle = KOTA_COLOR.markaPutih; ctx.lineWidth = 1.2; ctx.setLineDash([8, 12]);
            edges.forEach(edge => { 
                ctx.beginPath(); let started = false;
                for (let t = 0; t <= 1; t += 0.01) { 
                    let pt = getCubicBezierPoint(nodes[edge.from], edge.ctrl1, edge.ctrl2, nodes[edge.to], t); 
                    if (!isDiDalamBundaran(pt.x, pt.y)) {
                        if (!started) { ctx.moveTo(pt.x, pt.y); started = true; } else { ctx.lineTo(pt.x, pt.y); }
                    } else {
                        if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
                    }
                } 
                if (started) ctx.stroke();
            });
            ctx.setLineDash([]); 

            bundaranList.forEach(b => { 
                ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.radiusTaman + 1.2, 0, Math.PI * 2); ctx.fill(); 
                
                let circ = 2 * Math.PI * b.radiusTaman;
                let numSegments = Math.floor(circ / 10);
                if (numSegments % 2 !== 0) numSegments++;
                let angleStep = (2 * Math.PI) / numSegments;
                for (let i = 0; i < numSegments; i++) {
                    ctx.strokeStyle = (i % 2 === 0) ? "#ffffff" : "#111111";
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(b.x, b.y, b.radiusTaman + 0.5, i * angleStep, (i + 1) * angleStep);
                    ctx.stroke();
                }

                ctx.fillStyle = "#27ae60"; ctx.beginPath(); ctx.arc(b.x, b.y, b.radiusTaman, 0, Math.PI * 2); ctx.fill(); 
            });

            rukoComplexes.forEach(comp => {
                ctx.save(); ctx.translate(comp.x, comp.y); ctx.rotate(comp.sisi + Math.PI/2); 
                
                if (comp.hasParking && !comp.isGangHouse) {
                    ctx.fillStyle = KOTA_COLOR.aspal; ctx.fillRect(-comp.wParkir, -4, comp.wParkir * 2, comp.hParkir + 4);
                    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 0.8;
                    let slotW = 14; let slotCounter = 0;
                    for (let xOff = -comp.wParkir + 3; xOff <= comp.wParkir - slotW; xOff += slotW) {
                        ctx.strokeRect(xOff, -2, slotW, comp.hParkir);
                        let k = comp.kendaraanParkir.find(k => k.slotIdx === slotCounter);
                        if (k) { ctx.save(); ctx.translate(xOff + slotW/2, comp.hParkir / 2); ctx.fillStyle = k.warna; if (k.tipe === 'mobil') ctx.fillRect(-3.5, -5.5, 7, 11); else ctx.fillRect(-1, -3.5, 2, 7); ctx.restore(); }
                        slotCounter++;
                    }
                }

                let baseOffsetY = -comp.hParkir;
                
                ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
                ctx.fillRect(-comp.wRuko - 1.5, -comp.hRuko + baseOffsetY - 1.5, comp.wRuko * 2 + 3, comp.hRuko + 3);

                ctx.fillStyle = comp.isGangHouse ? "#ced4da" : "#6f4e37"; 
                ctx.fillRect(-comp.wRuko, -comp.hRuko + baseOffsetY, comp.wRuko * 2, comp.hRuko); 

                if (comp.isGangHouse) {
                    ctx.fillStyle = "#e74c3c"; 
                    ctx.fillRect(-comp.wRuko, -comp.hRuko + baseOffsetY, comp.wRuko * 2, comp.hRuko);
                    ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 1.8;
                    ctx.beginPath(); ctx.moveTo(0, -comp.hRuko + baseOffsetY); ctx.lineTo(0, baseOffsetY); ctx.stroke();
                } else {
                    ctx.fillStyle = "#b8860b"; 
                    ctx.fillRect(-comp.wRuko + 1.5, -comp.hRuko + baseOffsetY + 1.5, comp.wRuko * 2 - 3, comp.hRuko - 3);
                }
                
                ctx.fillStyle = "#212529"; 
                ctx.fillRect(-comp.wRuko + 2.5, baseOffsetY - 4, 3.5, 4); 
                ctx.fillRect(comp.wRuko - 5.5, baseOffsetY - 3, 3, 2.5);  

                ctx.restore();
            });

     
            vegetation.forEach(v => {
                ctx.save(); ctx.translate(v.x, v.y); ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.beginPath(); ctx.arc(v.radius*0.2, v.radius*0.2, v.radius, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = KOTA_COLOR.batangPohon; ctx.fillRect(-v.radius*0.15, -v.radius*0.15, v.radius*0.3, v.radius*0.3);
                ctx.fillStyle = KOTA_COLOR.daunPohonTua; ctx.beginPath(); ctx.arc(0, 0, v.radius, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = KOTA_COLOR.daunPohonMuda; ctx.beginPath(); ctx.arc(-v.radius*0.15, -v.radius*0.15, v.radius*0.68, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            });

       
            if (navigation.startPos) { ctx.fillStyle = "#3498db"; ctx.beginPath(); ctx.arc(navigation.startPos.x, navigation.startPos.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); }
            if (navigation.endPos) { ctx.fillStyle = "#e74c3c"; ctx.beginPath(); ctx.arc(navigation.endPos.x, navigation.endPos.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke(); }
            if (navigation.startPos) {
                ctx.save(); ctx.translate(navigation.objX, navigation.objY); ctx.rotate(navigation.objAngle);
                switch(navigation.objectType) {
                    case 'mobil': ctx.fillStyle = "#3498db"; ctx.fillRect(-11, -5.5, 22, 11); ctx.fillStyle = "#ffffff"; ctx.fillRect(3.5, -3.5, 3.5, 7); break;
                    case 'motor': ctx.fillStyle = "#e74c3c"; ctx.fillRect(-7, -1.8, 14, 3.6); break;
                    case 'sepeda': ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.stroke(); break;
                }
                ctx.restore();
            }
            ctx.restore();
        }

        function animationLoop(timestamp) { 
            let dt = timestamp - lastTime;
            lastTime = timestamp;

            if (dt > 100) dt = 16.67; 

            updateSimulation(dt); 
            draw(); 
            requestAnimationFrame(animationLoop); 
        }

        canvas.addEventListener('mousedown', (e) => { camera.isDragging = true; camera.hasDragged = false; camera.startX = e.clientX - camera.x; camera.startY = e.clientY - camera.y; });
        canvas.addEventListener('mousemove', (e) => { 
            if (!camera.isDragging) return; 
            camera.x = e.clientX - camera.startX; 
            camera.y = e.clientY - camera.startY; 
            camera.hasDragged = true; 
            draw();
        });
        canvas.addEventListener('mouseup', (e) => {
            camera.isDragging = false;
            if (!camera.hasDragged) {
                let mouseX = (e.clientX - canvas.width / 2) / camera.zoom + canvas.width / 2 - camera.x;
                let mouseY = (e.clientY - canvas.height / 2) / camera.zoom + canvas.height / 2 - camera.y;
                let titikJalan = dapatkanTitikTerdekatJalan(mouseX, mouseY);

                if (titikJalan) {
                    if (!navigation.startPos) {
                        navigation.startPos = titikJalan; navigation.objX = titikJalan.x; navigation.objY = titikJalan.y;
                        
                        camera.x = (canvas.width / 2) - titikJalan.x;
                        camera.y = (canvas.height / 2) - titikJalan.y;
                        
                        document.getElementById('status-val').innerText = "Pilih Titik Tujuan";
                    } else if (!navigation.endPos) {
                        navigation.endPos = titikJalan;
                        hitungRuteNavigasi(navigation.startPos.edgeIndex, navigation.endPos.edgeIndex);
                        if(navigation.waypoints && navigation.waypoints.length > 0) { navigation.objX = navigation.waypoints[0].x; navigation.objY = navigation.waypoints[0].y; navigation.objAngle = navigation.waypoints[0].angle; }
                        let jarakNyata = hitungHaversine(navigation.startPos.x, navigation.startPos.y, navigation.endPos.x, navigation.endPos.y);
                        document.getElementById('jarak-val').innerText = jarakNyata.toFixed(1);
                        document.getElementById('status-val').innerText = "Rute Siap! Klik Mulai.";
                    } else {
                        resetNavigation(); navigation.startPos = titikJalan; navigation.objX = titikJalan.x; navigation.objY = titikJalan.y;
                        camera.x = (canvas.width / 2) - titikJalan.x;
                        camera.y = (canvas.height / 2) - titikJalan.y;
                        document.getElementById('status-val').innerText = "Pilih Titik Tujuan";
                    }
                    draw();
                }
            }
        });

        window.addEventListener('wheel', (e) => {
            if (e.deltaY < 0) camera.zoom = Math.min(camera.zoom + 0.1, 2.5); else camera.zoom = Math.max(camera.zoom - 0.1, 0.4);
            document.getElementById('zoom-val').innerText = camera.zoom.toFixed(1);
            draw();
        });

        window.gantiKendaraan = function(tipe) { navigation.objectType = tipe; draw(); };
        document.getElementById('btn-acak-map').addEventListener('click', generateCityMap);
        document.getElementById('btn-reset').addEventListener('click', () => { resetNavigation(); draw(); });
        document.getElementById('btn-start-pause').addEventListener('click', () => {
            if(navigation.startPos && navigation.endPos && navigation.waypoints.length > 0) {
                navigation.isActive = !navigation.isActive;
                const btn = document.getElementById('btn-start-pause');
                if (navigation.isActive) {
                    btn.innerText = "PAUSE";
                    btn.classList.add('paused');
                    document.getElementById('status-val').innerText = "Simulasi Berjalan...";
                } else {
                    btn.innerText = "MULAI";
                    btn.classList.remove('paused');
                    document.getElementById('status-val').innerText = "Simulasi Pause.";
                }
            }
        });

        generateCityMap();
        requestAnimationFrame(animationLoop);