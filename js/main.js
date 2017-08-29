function init() {

    var frame_id;
    var throw_disk = false;
    var i, j, disks, games;

    var stats = initStats();

    Physijs.scripts.worker = 'js/physijs_worker.js';
    Physijs.scripts.ammo = 'ammo.js';

    // create a scene, that will hold all our elements such as objects, cameras and lights.
    var scene = new Physijs.Scene;
    scene.setGravity(new THREE.Vector3(0, -50, 0));

    // create a camera, which defines where we're looking at.
    var camera = new THREE.PerspectiveCamera(35,
        window.innerWidth / window.innerHeight,
        1,
        1000);

    // create a render and set the size
    var webGLRenderer = new THREE.WebGLRenderer({antialias: true});
    webGLRenderer.setClearColor(new THREE.Color("#fff"));
    webGLRenderer.setSize(window.innerWidth, window.innerHeight);

    var disk = addDisk(),
        current_disk = 0,
        current_game = 0,
        current_vel;

    // add the disk to the scene
    scene.add(disk);

    // position and point the camera to the center of the scene
    camera.position.set(0, 60, 100);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Light
    light = new THREE.PointLight(0xFFFFFF);
    light.position.set(20, 80, 50);
    scene.add(light);

    // add the output of the renderer to the html element
    document.getElementById("viewport").appendChild(webGLRenderer.domElement);

    // Create ground
    var loader = new THREE.TextureLoader();
    var ground_material = Physijs.createMaterial(
        new THREE.MeshPhongMaterial({map: loader.load('assets/textures/wood-3.jpg')}),
        .9, .3);

    var ground = new Physijs.BoxMesh(new THREE.BoxGeometry(60, 1, 80), ground_material, 0);
    ground.position.z = -20;
    ground.position.y = -20;
    scene.add(ground);

    var handleCollision = function (object, linearVelocity, angularVelocity) {

        object.setLinearVelocity(new THREE.Vector3(0, 0, 0));

        // Move to pile
        var pile_idx = Math.floor(object.position.x / n_piles) + n_piles / 2;
        var this_pile = disk_piles[pile_idx];

        this_pile.push(object);
        scene.remove(object);

        // Update histogram
        points = disk_piles.map(function (d, idx) {
            return {x: (idx - 4) * 2 * 4 + 4, y: d.length, z: -50};
        });
        histogram.update(points);

        current_disk += 1;
        // Add another disk
        disk = addDisk();
        scene.add(disk);

        if (current_disk >= disks) {
            // Fit gaussian, get offset. In the meantime offset is the maximum.
            var offsetMax = d3.max(points, function (d) {
                return d.y;
            });
            offsets.push({pucks: disks, offset: offsetMax});
            // update plot
            plot.update_cell(points, i, j);
            current_game++;

            if (current_game < games) {
                current_disk = 0;
                for (disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
                points = disk_piles.map(function (d, idx) {
                    return {x: (idx - 4) * 2 * 4 + 4, y: d.length, z: -50};
                });
                histogram.update(points);
            } else {
                throw_disk = false;
                // fit gaussian

            }

        }


    };

    var wall_material = Physijs.createMaterial(
        new THREE.MeshPhongMaterial({map: loader.load('assets/textures/wood-3.jpg'), opacity: 0.9}),
        .0, .3);
    var wallTop = new Physijs.BoxMesh(new THREE.BoxGeometry(60, 60, 2), wall_material, 0);
    wallTop.position.z = -60;
    wallTop.position.y = -10;
    wallTop.rotation.set(-Math.PI / 6, 0, 0);
    wallTop.addEventListener('collision', handleCollision);
    scene.add(wallTop);

    var lines = d3.range(-20, 30, 10).map(function(d){
        var color = (d==0) ? 'red' : 'blue';
        return { x: d, color: color}
    });

    lines.forEach(function(d){
        var line_geometry = new THREE.PlaneGeometry( 1, 80, 2 );
        var line_material = new THREE.MeshBasicMaterial( {
            color: d.color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.2
        });
        var line = new THREE.Mesh(line_geometry, line_material);
        line.rotation.set(Math.PI/2, 0, 0);
        line.position.set(d.x, -19.5, -20);
        scene.add(line);

        line_geometry = new THREE.PlaneGeometry( 1, 41, 2 );
        line = new THREE.Mesh(line_geometry, line_material);
        line.rotation.set(-Math.PI / 6, 0, 0);
        line.position.set(d.x, -1, -62.5);
        scene.add(line);

        if (d.color == 'red'){
            line_geometry = new THREE.PlaneGeometry( 1, 60, 2 );
            line = new THREE.Mesh(line_geometry, line_material);
            line.rotation.set(0, 0, Math.PI/2);
            line.position.set(d.x, -19, -53);
            scene.add(line);

            var dot_geometry = new THREE.CircleBufferGeometry( 1, 32 );
            var dot = new THREE.Mesh( dot_geometry, line_material );
            dot.position.set(0,-18.5, 0);
            dot.rotation.set(Math.PI/2,0,0);
            scene.add(dot);
        }

    });



    var n_piles = Math.round(60 / (2 * 4)); // wallTopLength / 2 * diskRadius
    for (var disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
    var points = disk_piles.map(function (d, idx) {
        return {x: (idx - 4) * 2 * 4 + 4, y: d.length, z: -50};
    });
    var histogram = new Histogram(),
        plot = new Plot(),
        offsets = [];
    histogram.init(points);
    plot.init(); //points.length, max_disks);

    // call the render function
    var step = 0;

    // setup the control gui
    var controls = new function () {

        this.diskRestitution = 1.0;
        this.diskFriction = 0.5;
        this.velocity = 50;

        this.redraw = function () {

            // Restart piles
            for (disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
            points = disk_piles.map(function (d, idx) {
                return {x: (idx - 4) * 2 * 4 + 4, y: d.length, z: -50};
            });
            histogram.update(points);

            // Create a new one
            current_disk = 0;
            var disk_material = Physijs.createMaterial(
                new THREE.MeshLambertMaterial({color: 0x444444, opacity: 0.9, transparent: true}),
                controls.diskRestitution, // high friction
                controls.diskFriction // medium restitution
            );

            var disk_geometry = new THREE.CylinderGeometry(4, 4, 2, 100);
            disk = new Physijs.CylinderMesh(
                disk_geometry,
                disk_material,
                100
            );
            disk.position.set(0, -18.5, 0);
            disk.__dirtyPosition = true;
            // add it to the scene and to the array of disks.
            scene.add(disk);

            render();

        };
    };

    var gui = new dat.GUI();
    gui.add(controls, 'diskRestitution', 0, 1).onChange(controls.redraw);
    gui.add(controls, 'diskFriction', 0, 1).onChange(controls.redraw);
    gui.add(controls, 'velocity', 0, 100).onChange(controls.redraw);

    frame_id = requestAnimationFrame(render);
    webGLRenderer.render(scene, camera);
    

    function throwDisks(n_disks, n_games) {

        for (var games = 0; games < n_games; games++) {
            for (var disks = 0; disks < n_disks; disks++) {

                var min = -5, max = 5;
                var ran_number = Math.random() * (max - min) + min;
                current_vel = disk.getLinearVelocity();
                disk.setLinearVelocity(new THREE.Vector3(current_vel.x + ran_number, 0, -controls.velocity));

                frame_id = requestAnimationFrame(render);
                webGLRenderer.render(scene, camera);

                scene.simulate(undefined, 1);
            }
        }
    }


    function render() {
        stats.update();

        if (throw_disk){
            var min = -5, max = 5;
            var ran_number = Math.random() * (max - min) + min;
            current_vel = disk.getLinearVelocity();
            disk.setLinearVelocity(new THREE.Vector3(current_vel.x + ran_number, 0, -controls.velocity));
        }

        // render using requestAnimationFrame
        frame_id = requestAnimationFrame(render);
        webGLRenderer.render(scene, camera);

        scene.simulate(undefined, 1);

    }

    function initStats() {

        var stats = new Stats();
        stats.setMode(0); // 0: fps, 1: ms

        // Align top-left
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.left = '0px';
        stats.domElement.style.top = '0px';

        document.getElementById("viewport").appendChild(stats.domElement);

        return stats;
    }

    function addDisk() {

        var disk_material = Physijs.createMaterial(
            new THREE.MeshLambertMaterial({color: "#666666", opacity: 1.0, transparent: true}),
            1.0, // high friction
            .5 // medium restitution
        );

        var disk_geometry = new THREE.CylinderGeometry(4, 4, 2, 100);
        var disk = new Physijs.CylinderMesh(
            disk_geometry,
            disk_material,
            100
        );
        disk.position.set(0, -18.5, 0);
        disk.__dirtyPosition = true;

        return disk;
    }

    function Histogram() {

        this.margin = {top: 40, right: 40, bottom: 40, left: 50};
        this.width = 400;
        this.height = 300;

        this.div = d3.select("#viewport");

        this.svg = this.div.append("svg")
            .attr("id", "histogram")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .style("position", "absolute")
            .style("left", window.innerWidth / 2 - this.width / 2 - 2 * this.margin.left + this.margin.right)
            .style("top", -20);

        this.g = this.svg.append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.x = d3.scaleBand().range([0, this.width]).padding(0.1);
        this.y = d3.scaleLinear().range([this.height, 0]);

        this.init = function (data) {

            this.x.domain(d3.range(data.length));
            this.y.domain([0, 10]); // disks

            var that = this;

            this.g.append("g")
                .attr("class", "axis axis--x")
                .attr("transform", "translate(0," + this.height + ")")
                .call(d3.axisBottom(this.x));
            this.g.append("g")
                .attr("class", "axis axis--y")
                .attr("transform", "translate(" + this.width / 2 + ",0)")
                .call(d3.axisLeft(this.y));
            this.g.selectAll("rect")
                .data(data)
                .enter().append("rect")
                .attr("class", "bar")
                .attr("fill", "#222222")
                .attr("x", function (d, i) {
                    return that.x(i);
                })
                .attr("y", function (d) {
                    return that.y(d.y);
                })
                .attr("width", this.x.bandwidth())
                .attr("height", function (d) {
                    return that.height - that.y(d.y);
                });

        };

        this.update = function (data) {

            var that = this;

            this.selection = this.g.selectAll(".bar")
                .data(data);

            this.selection.exit().remove();

            this.selection.attr("class", "bar")
                .transition().duration(100)
                .attr("y", function (d) {
                    return that.y(d.y);
                })
                .attr("height", function (d) {
                    return that.height - that.y(d.y);
                });

            this.selection.enter().append("rect")
                .attr("class", "bar")
                .transition().duration(100)
                .attr("y", function (d) {
                    return that.y(d.y);
                })
                .attr("height", function (d) {
                    return that.height - that(d.y);
                });

        };
    }


    function Plot() {

        this.margin = {top: 40, right: 40, bottom: 40, left: 50};
        this.cell_size = 100;
        this.number_pucks = [1, 2, 3, 5];
        this.number_games = [1, 2, 3, 5];
        this.n = this.number_pucks.length;
        this.width = this.cell_size * (this.n + 1) - this.margin.left - this.margin.right;
        this.height = this.cell_size * (this.n + 1) - this.margin.top - this.margin.bottom;

        this.cross_data = cross(this.number_pucks, this.number_games);

        this.div = d3.select("#viewport");

        this.svg = this.div.append("svg")
            .attr("id", "plot")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom)
            .style("position", "absolute")
            .style("left", window.innerWidth * 2 / 3)
            .style("top", window.innerHeight / 2 - this.height / 2 - 2 * this.margin.top + this.margin.bottom);

        this.g = this.svg.append("g")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.x = d3.scaleLinear().range([0, this.cell_size])
            .domain([-30, 30]);
        this.y = d3.scaleLinear().range([this.cell_size, 0])
            .domain([0, d3.max(this.number_pucks)]); // disks
        this.line = d3.line();

        this.init = function () { //points, max_disks){

            var that = this;

            this.x_axis = this.svg.selectAll(".x.axis")
                .data(this.number_pucks).enter().append("g")
                .attr("class", "x axis");
            this.x_axis.attr("transform", function (d, i) {
                    return "translate(" + ((that.n - i - 1) * that.cell_size + that.margin.left) + "," +
                        (that.margin.top + that.n * that.cell_size) + ")";
                })
                .each(function (d, i) {
                    d3.select(this).call(d3.axisBottom(that.x).ticks(8))
                });

            this.y_axis = this.svg.selectAll(".y.axis")
                .data(this.number_games).enter().append("g")
                .attr("class", "y axis");
            this.y_axis.attr("transform", function (d, i) {
                    return "translate(" + that.margin.left + "," + (i * that.cell_size + that.margin.top) + ")";
                })
                .each(function (d, i) {
                    d3.select(this).call(d3.axisLeft(that.y))
                });

            this.cross_data.forEach(function (d) {

                var cell = that.g.append("g")
                    .datum(d)
                    .attr("class", "cell")
                    .attr("transform", function (d) {
                        return "translate(" + (that.n - d.i - 1) * that.cell_size + "," + d.j * that.cell_size + ")";
                    });

                cell.append("rect")
                    .attr("class", "frame")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", that.cell_size)
                    .attr("height", that.cell_size)
                    .on("click", function (d) {
                        i = d.i;
                        j = d.j;
                        disks = d.x;
                        games = d.y;

                        // Reset everything
                        current_disk = 0;
                        current_game = 0;
                        throw_disk = true;
                        for (disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
                        points = disk_piles.map(function (d, idx) {
                            return {x: (idx - 4) * 2 * 4 + 4, y: d.length, z: -50};
                        });
                        histogram.update(points);
                        console.log(d);
                    });

            });

        };

        this.update_cell = function (data, i, j) {

            var that = this;

            this.line.x(function (d) {
                    return that.x(d.x)
                })
                .y(function (d) {
                    return that.y(d.y)
                });

            this.g.selectAll(".cell")
                .filter(function(d){ return d.i === i & d.j === j;})
                .append("path")
                .datum(data)
                .attr("class", "line")
                .attr("fill", "none")
                .attr("stroke", "black")
                .attr("opacity", 0.1)
                .attr("stroke-linejoin", "round")
                .attr("stroke-linecap", "round")
                .attr("stroke-width", 1.5)
                .attr("d", this.line);


        };

        function cross(a, b) {
            var c = [], n = a.length, m = b.length, i, j;
            for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j});
            return c;
        }

    }
}

window.onload = init;
