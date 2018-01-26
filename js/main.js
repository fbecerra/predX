function init() {

    d3.json("data/data.json", function(error, realizations) {
        if (error) throw error;

        var frame_id;
        var throw_disk = false;
        var i, j, disks, games, all_points = [], run_all = false;

        var number_pucks = [10, 5, 2, 1],
            number_games = [10, 5, 2, 1],
            cross_data = cross(number_pucks, number_games);

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

        var disk_radius = 4,
            disk_height = 2,
            disk_position_y = -18.5,
            disk = addDisk(),
            current_disk = 0,
            current_game = 0,
            current_vel,
            disk_velocity,
            max_side_vel;

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

        var ground_width = 60,
            ground_height = 1,
            ground_depth = 80,
            ground_position_z = -20,
            ground_position_y = -20;
        var ground = new Physijs.BoxMesh(new THREE.BoxGeometry(ground_width, ground_height, ground_depth), ground_material, 0);
        ground.position.z = ground_position_z;
        ground.position.y = ground_position_y;
        scene.add(ground);

        var handleCollision = function (object, linearVelocity, angularVelocity) {

            object.setLinearVelocity(new THREE.Vector3(0, 0, 0));

            // Move to pile
            var pile_idx = Math.floor(object.position.x / (2 * disk_radius) + n_piles/2); //+ Math.floor(n_piles / 2);
            var this_pile = disk_piles[pile_idx];

            this_pile.push(object);
            scene.remove(object);

            // Update histogram
            points = disk_piles.map(function (d, idx) {
                return {x: (idx - disk_radius) * 2 * disk_radius, y: d.length, z: -50};
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

                for (var ele in points){
                    all_points.push(points[ele]);
                }

                histogram.add_circles(points);

                if (current_game < games) {
                    // rest disk count
                    current_disk = 0;
                    for (disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
                    points = disk_piles.map(function (d, idx) {
                        return {x: (idx - disk_radius) * 2 * disk_radius, y: d.length, z: -50};
                    });
                    histogram.update(points);
                    game_label.update_label(current_game+1)
                } else {
                    throw_disk = false;
                    var fitted_data = fitGaussian(all_points);
                    console.log(fitted_data)
                    plot.draw_fit(fitted_data[0], i, j, fitted_data[1]);
                    if (run_all){
                        runNextCell();
                    }
                }

            }


        };

        var wall_material = Physijs.createMaterial(
            new THREE.MeshPhongMaterial({map: loader.load('assets/textures/wood-3.jpg'), opacity: 0.9}),
            .0, .3);
        var wall_width = 60,
            wall_height = 40,
            wall_depth = 2,
            wall_rotation = Math.PI / 6;
        var wall = new Physijs.BoxMesh(new THREE.BoxGeometry(wall_width, wall_height, wall_depth), wall_material, 0);
        wall.position.z = -60;
        wall.position.y = -3;
        wall.rotation.set(-wall_rotation, 0, 0);
        wall.addEventListener('collision', handleCollision);
        scene.add(wall);

        var svg_position = toScreenPosition(wall.position.clone());

        var lines = d3.range(-24, 30, 6).map(function(d){
            var color = (d==0) ? 'red' : "#464EAA";
            return { x: d, color: color}
        });

        lines.forEach(function(d){
            var line_geometry = new THREE.PlaneGeometry( 1, 80, 2 );
            var line_material = new THREE.MeshBasicMaterial( {
                color: d.color,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.5
            });
            var line = new THREE.Mesh(line_geometry, line_material);
            line.rotation.set(Math.PI/2, 0, 0);
            line.position.set(d.x, -19.5, -20);
            scene.add(line);

            line_geometry = new THREE.PlaneGeometry( 1, 41, 2 );
            line = new THREE.Mesh(line_geometry, line_material);
            line.rotation.set(-Math.PI / 6, 0, 0);
            line.position.set(d.x, -2.8, -58);
            scene.add(line);

            if (d.color == 'red'){
                line_geometry = new THREE.PlaneGeometry( 1, 60, 2 );
                line = new THREE.Mesh(line_geometry, line_material);
                line.rotation.set(-Math.PI / 6, 0, Math.PI/2);
                line.position.set(d.x, -19, -49.5);
                scene.add(line);

                var dot_geometry = new THREE.CircleBufferGeometry( 1, 32 );
                var dot = new THREE.Mesh( dot_geometry, line_material );
                dot.position.set(0,-18.5, 0);
                dot.rotation.set(Math.PI/2,0,0);
                scene.add(dot);
            }

        });



        var n_piles = Math.round(wall_width / (2 * disk_radius));
        if (n_piles % 2 == 0){
            n_piles += 1;
        }
        for (var disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
        var points = disk_piles.map(function (d, idx) {
            return {x: (idx - disk_radius) * 2 * disk_radius, y: d.length, z: -50};
        });
        var histogram = new Histogram(),
            plot = new Plot(),
            instructions = new Instructions(),
            game_label = new GameLabel();
            offsets = [];
        histogram.init(points);
        plot.init(); //points.length, max_disks);
        instructions.init();

        // call the render function
        var step = 0;

        frame_id = requestAnimationFrame(render);
        webGLRenderer.render(scene, camera);


        function render() {

            if (throw_disk){
                var side_vel = (Math.random() * 2 - 1) * max_side_vel;
                current_vel = disk.getLinearVelocity();
                disk.setLinearVelocity(new THREE.Vector3(current_vel.x + side_vel, 0, -disk_velocity));
            }

            // render using requestAnimationFrame
            frame_id = requestAnimationFrame(render);
            webGLRenderer.render(scene, camera);

            scene.simulate(undefined, 1);

        }


        function addDisk() {

            var disk_material = Physijs.createMaterial(
                new THREE.MeshLambertMaterial({color: "#666666", opacity: 1.0, transparent: true}),
                1.0, // high friction
                .5 // medium restitution
            );

            var disk_geometry = new THREE.CylinderGeometry(disk_radius, disk_radius, disk_height, 100);
            var disk = new Physijs.CylinderMesh(
                disk_geometry,
                disk_material,
                100
            );
            disk.position.set(0, disk_position_y, 0);
            disk.__dirtyPosition = true;

            return disk;
        }

        function Histogram() {

            this.margin = {top: 10, right: 0, bottom: 20, left: 0};
            this.width = wall_width * 7.5;
            this.height = wall_height * 7.5;

            this.div = d3.select("#viewport");

            this.svg = this.div.append("svg")
                .attr("id", "histogram")
                .attr("width", this.width + this.margin.left + this.margin.right)
                .attr("height", this.height + this.margin.top + this.margin.bottom)
                .style("position", "absolute")
                .style("left", svg_position.x - this.width/2)
                .style("top", svg_position.y - this.height * 1.5 + this.margin.top);

            this.g = this.svg.append("g")
                .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

            this.x = d3.scaleBand().range([0, this.width]).padding(0.1);
            this.y = d3.scaleLinear().range([this.height, 0]);

            this.init = function (data) {

                this.x.domain(d3.range(data.length));
                this.y.domain([0, 10]); // disks

                var that = this;

                /*this.g.append("g")
                    .attr("class", "axis axis--x")
                    .attr("transform", "translate(0," + this.height + ")")
                    .call(d3.axisBottom(this.x));*/

                this.g.append("g")
                    .attr("class", "axis axis--y")
                    .attr("transform", "translate(" + (this.width/2) + ",0)")
                    .call(d3.axisLeft(this.y).tickValues(d3.range(1,10)));

                this.g.selectAll("rect")
                    .data(data)
                    .enter().append("rect")
                    .attr("class", "bar")
                    .attr("fill", "#222222")
                    .attr("opacity", "0.5")
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

                // Update histogram
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

            this.add_circles = function (data){

                var that = this;

                this.g.selectAll(".newpoints")
                 .data(data)
                 .enter().append("circle")
                 .attr("class", "points")
                 .attr("fill", "#222222")
                 .attr("opacity", function(d){
                     return d.y > 0 ? 0.3 : 0;
                 })
                 .attr("r", 5)
                 .attr("cx", function (d, i) {
                    return that.x(i) + that.x.bandwidth()/2;
                 })
                 .attr("cy", function (d) {
                    return that.y(d.y);
                 });

            };

            this.remove_circles = function (){

                // Update histogram
                this.selection = this.g.selectAll(".points")
                    .data([]);

                this.selection.exit().remove();

            };
        }


        function Instructions() {

            this.margin = {top: 10, right: 20, bottom: 20, left: 20};
            this.width = 200;
            this.height = 500;

            this.div = d3.select("#viewport");
            this.svg = this.div.append("svg")
                .attr("id", "slider")
                .attr("width", this.width + this.margin.left + this.margin.right)
                .attr("height", this.height + this.margin.top + this.margin.bottom)
                .style("position", "absolute")
                .style("left", 200 - this.width/2)
                .style("top", 100 - this.margin.top);

            /* Title */
            this.svg.append("g")
                .attr("transform", "translate(" + this.margin.left + "," + this.height/8 + ")")
                .attr("id", "grouptitle")
                .append("text")
                .attr("id", "title")
                .html("Title");

            /* Description */
            this.svg.append("g")
                .attr("transform", "translate(" + this.margin.left + "," + this.height/6 + ")")
                .append("text")
                .attr("id", "description")
                .html("<tspan x='0' dy='1.2em'>Click on the cells to start playing!</tspan>" +
                    "<tspan x='0' dy='1.2em'>If at any point you get bored, we</tspan>" +
                    "<tspan x='0' dy='1.2em'>can <a id='text-link'>do the rest for you!</a></tspan>" +
                    "<tspan x='0' dy='1.2em'> </tspan>" +
                    "<tspan x='0' dy='1.2em'>Once you have finished, you can</tspan>" +
                    "<tspan x='0' dy='1.2em'>explore different realizations by</tspan>" +
                    "<tspan x='0' dy='1.2em'>moving the slider below</tspan>" +
                    "<tspan x='0' dy='1.2em'></tspan>");

            d3.select("#text-link").on("click", function(d){
                runNextCell();
            });



            this.slider = this.svg.append("g")
                .attr("class", "slider")
                .attr("transform", "translate(" + this.margin.left + "," + this.height/2 + ")");

            this.x = d3.scaleLinear()
                .domain([0, 1])
                .range([0, this.width])
                .clamp(true);

            this.init = function () {

                var that = this;

                this.slider.append("line")
                    .attr("class", "track")
                    .attr("x1", that.x.range()[0])
                    .attr("x2", that.x.range()[1])
                    .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
                    .attr("class", "track-inset")
                    .select(function() { return this.parentNode.appendChild(this.cloneNode(true)); })
                    .attr("class", "track-overlay")
                    .call(d3.drag()
                        .on("start.interrupt", function() { that.slider.interrupt(); })
                        .on("start drag", function() {
                            plot.update_all_cells(that.x.invert(d3.event.x));
                            that.handle.attr("cx", that.x(that.x.invert(d3.event.x)));
                        }));

                this.slider.insert("g", ".track-overlay")
                    .attr("class", "ticks")
                    .attr("transform", "translate(0," + 18 + ")")
                    .selectAll("text")
                    .data(that.x.ticks(10))
                    .enter().append("text")
                    .attr("x", that.x)
                    .attr("text-anchor", "middle")
                    .text(function(d) { return d; });

                this.handle = this.slider.insert("circle", ".track-overlay")
                    .attr("class", "handle")
                    .attr("r", 9);

            };

        }

        function GameLabel() {

            this.margin = {top: 10, right: 20, bottom: 20, left: 30};
            this.width = 400;
            this.height = 60;

            this.div = d3.select("#viewport");

            this.svg = this.div.append("svg")
                .attr("width", this.width + this.margin.left + this.margin.right)
                .attr("height", this.height + this.margin.top + this.margin.bottom)
                .style("position", "absolute")
                .style("left", 700) // window_width /2
                .style("top", 720);

            this.group = this.svg.append("g")
                .attr("transform", "translate(" + this.margin.left + "," + this.height / 2 + ")");

            this.text = this.group.append("text")
                .attr("class", "gameLabel")
                .attr("text-anchor", "middle")
                .html("");

            this.update_label = function (idx) {
                this.text.html("Game "+idx);
            };


        }

        function Plot() {

            this.margin = {top: 10, right: 10, bottom: 40, left: 50};
            this.cell_size = 100;
            this.n = number_pucks.length;
            this.width = this.cell_size * (this.n + 1) - this.margin.left - this.margin.right;
            this.height = this.cell_size * (this.n + 1) - this.margin.top - this.margin.bottom;


            this.div = d3.select("#viewport");

            this.svg = this.div.append("svg")
                .attr("id", "plot")
                .attr("width", this.width + this.margin.left + this.margin.right)
                .attr("height", this.height + this.margin.top + this.margin.bottom)
                .style("position", "absolute")
                .style("left", window.innerWidth * 2 / 3)
                .style("top", window.innerHeight / 3 - this.height / 2 - 5 * this.margin.top + this.margin.bottom);

            this.g = this.svg.append("g")
                .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

            this.x = d3.scaleLinear().range([0, this.cell_size])
                .domain([-wall_width/2, wall_width/2]);
            this.y = d3.scaleLinear().range([this.cell_size, 0])
                .domain([0, d3.max(number_pucks)]); // disks
            this.line = d3.line();

            this.init = function () { //points, max_disks){

                var that = this;

                /*this.x_axis = this.svg.selectAll(".x.axis")
                 .data(number_pucks).enter().append("g")
                 .attr("class", "x axis");
                 this.x_axis.attr("transform", function (d, i) {
                 return "translate(" + ((that.n - i - 1) * that.cell_size + that.margin.left) + "," +
                 (that.margin.top + that.n * that.cell_size) + ")";
                 })
                 .each(function (d, i) {
                 d3.select(this).call(d3.axisBottom(that.x).ticks(8))
                 });

                 this.y_axis = this.svg.selectAll(".y.axis")
                 .data(number_games).enter().append("g")
                 .attr("class", "y axis");
                 this.y_axis.attr("transform", function (d, i) {
                 return "translate(" + that.margin.left + "," + (i * that.cell_size + that.margin.top) + ")";
                 })
                 .each(function (d, i) {
                 d3.select(this).call(d3.axisLeft(that.y))
                 });*/

                this.svg.selectAll(".x.labels")
                    .data(number_pucks).enter().append("text")
                    .attr("class", "x labels")
                    .attr("x", function(d, i){
                        return (that.n - i - 1/2) * that.cell_size + that.margin.left ;
                    })
                    .attr("y", that.margin.top + that.n * that.cell_size + 24)
                    .text(function(d){
                        return ''+d;
                    });

                this.svg.selectAll(".y.labels")
                    .data(number_pucks).enter().append("text")
                    .attr("class", "y labels")
                    .attr("x", that.margin.left - 24)
                    .attr("y", function(d, i){
                        return (i + 1/2) * that.cell_size + that.margin.top;
                    })
                    .text(function(d){
                        return ''+d;
                    });

                this.svg.append("text")
                    .attr("x", this.cell_size * (this.n - 1)/2 + this.margin.left)
                    .attr("y", this.height)
                    .attr("class", "axis-labels")
                    .attr("transform", "translate(0,10)")
                    .html("Number of pucks");

                this.svg.append("text")
                    .attr("x", 0)
                    .attr("y", (this.n + 1)/2 * that.cell_size + that.margin.top)
                    .attr("class", "axis-labels")
                    .attr("transform", "translate(-"+this.cell_size * (this.n +1)/2+","+
                        ((this.n + 1)* this.cell_size/2 + this.margin.top)+") rotate(-90)")
                    .html("Number of games");

                cross_data.forEach(function (d) {

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
                        .attr("fill", "white")
                        .on("click", function (d) {
                            i = d.i;
                            j = d.j;
                            disks = d.x;
                            games = d.y;
                            all_points = [];

                            disk_velocity = Math.sqrt(disks * games) * 50;
                            max_side_vel = disk_velocity/10;

                            // Reset everything
                            current_disk = 0;
                            current_game = 0;
                            game_label.update_label(current_game+1)
                            throw_disk = true;
                            for (disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
                            points = disk_piles.map(function (d, idx) {
                                return {x: (idx - disk_radius) * 2 * disk_radius, y: d.length, z: -50};
                            });
                            histogram.update(points);
                            histogram.remove_circles();
                            d.t = false;
                            d3.select(this).style("fill", "none");  // This cell is not clickable anymore
                        })
                        .on("mouseover", function() { d3.select(this).style("cursor", "pointer"); })
                        .on("mouseout", function(d) { d3.select(this).style("cursor", "default"); });

                });

            };

            this.update_cell = function (data, i, j) {

                var that = this;

                /* Add lines
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
                    .attr("opacity", 0.5/number_games[j])
                    .attr("stroke-linejoin", "round")
                    .attr("stroke-linecap", "round")
                    .attr("stroke-width", 1.5)
                    .attr("d", this.line);*/

                // Add dots
                this.g.selectAll(".cell")
                    .filter(function(d){ return d.i === i & d.j === j;})
                    //.append("circle")
                    .selectAll(".newdatapoints")
                    .data(data)
                    .enter().append("circle")
                    .attr("class", "datapoints")
                    .attr("fill", "#222222")
                    .attr("opacity", function(d){
                        return d.y > 0 ? 0.5 : 0;
                    })
                    .attr("r", 1.5)
                    .attr("cx", function (d, i) {
                        return that.x(d.x);
                    })
                    .attr("cy", function (d) {
                        return that.y(d.y);
                    });



            };

            this.update_all_cells = function(idx){

                var that = this;

                for (var key in realizations) { // realizations[idx][key]

                    // calculate i and j
                    var i, j;
                    [i,j] = key.split("-");

                    this.line.x(function (d) {
                            return that.x(d.x)
                        })
                        .y(function (d) {
                            return that.y(d.y)
                        });

                    this.lines =  this.g.selectAll(".cell")
                        .filter(function(d){ return d.i === +i & d.j === +j;})
                        .selectAll(".line")
                        .data(realizations[key]); // realizations [idx][key]

                    this.lines.attr("class", "line")
                        .attr("fill", "none")
                        .attr("stroke", "black")
                        .attr("opacity", 0.5/number_games[j])
                        .attr("stroke-linejoin", "round")
                        .attr("stroke-linecap", "round")
                        .attr("stroke-width", 1.5)
                        .attr("d", this.line);

                    this.lines.enter().append("path")
                        .attr("class", "line")
                        .attr("fill", "none")
                        .attr("stroke", "black")
                        .attr("opacity", 0.5/number_games[j])
                        .attr("stroke-linejoin", "round")
                        .attr("stroke-linecap", "round")
                        .attr("stroke-width", 1.5)
                        .attr("d", this.line);

                    this.lines.exit().remove();
                }

            };

            this.draw_fit = function (data, i, j, parameters) {

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
                    .attr("class", "fit")
                    .attr("fill", "none")
                    .attr("stroke", "red")
                    .attr("opacity", 0.7)
                    .attr("stroke-linejoin", "round")
                    .attr("stroke-linecap", "round")
                    .attr("stroke-width", 1.5)
                    .attr("d", this.line);

                this.g.selectAll(".cell")
                    .filter(function(d){ return d.i === i & d.j === j;})
                    .append("text")
                    .datum(parameters[0])
                    .attr("class", "parameters")
                    .attr("text-anchor", "middle")
                    .attr("dy", "1em")
                    .attr("x", plot.cell_size/2)
                    .text(function(d) { return "Height = "+d3.format(".1f")(d/10); });

                this.g.selectAll(".cell")
                    .filter(function(d){ return d.i === i & d.j === j;})
                    .append("text")
                    .datum(parameters[1])
                    .attr("class", "parameters")
                    .attr("text-anchor", "middle")
                    .attr("dy", "2em")
                    .attr("x", plot.cell_size/2)
                    .text(function(d) { return "Width = "+d3.format(".1f")(d/10); });

                console.log(parameters)
            };

        }

        function cross(a, b) {
            var c = [], n = a.length, m = b.length, i, j;
            for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({x: a[i], i: i, y: b[j], j: j, t:true});
            return c;
        }

        function runNextCell(){

            d3.selectAll(".frame").style("fill", "none");
            run_all = true;

            var filtered_data = cross_data.filter(function(d){return d.t === true;});

            if (filtered_data.length > 0){

                var this_data = filtered_data[0];

                i = this_data.i;
                j = this_data.j;
                disks = this_data.x;
                games = this_data.y;
                all_points = [];

                disk_velocity = Math.sqrt(disks * games) * 50;
                max_side_vel = disk_velocity / 10;

                // Reset everything
                current_disk = 0;
                current_game = 0;
                throw_disk = true;
                for (disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
                points = disk_piles.map(function (d, idx) {
                    return {x: (idx - disk_radius) * 2 * disk_radius, y: d.length, z: -50};
                });
                histogram.update(points);
                histogram.remove_circles();
                this_data.t = false;
            }
        }

        function toScreenPosition(vector)
        {
            var widthHalf = 0.5 * webGLRenderer.context.canvas.width;
            var heightHalf = 0.5 * webGLRenderer.context.canvas.height;

            vector.project(camera);

            vector.x = ( vector.x * widthHalf ) + widthHalf;
            vector.y = - ( vector.y * heightHalf ) + heightHalf;

            return {
                x: vector.x,
                y: vector.y
            };

        }

        function fitGaussian(data){

            // WE NEED TO NORMALIZE DATA!!

            var model = function (a, x) {
                var i, j, result = [], sig2 = a[1] * a[1], norm;
                norm = a[0] / Math.sqrt(2 * Math.PI * sig2);

                x = optimize.vector.atleast_1d(x);
                a = optimize.vector.atleast_1d(a);

                for (i = 0; i < x.length; i++) {
                    var diff = x[i] - a[2];
                    result.push(norm * Math.exp(-0.5 * diff * diff / sig2));
                }

                for (j = 3; j < a.length; j++) {
                    for (i = 0; i < x.length; i++) {
                        result[i] += a[j] * Math.pow(x[i], j - 3);
                    }
                }

                return result;
            };
            var i, p1, chi;
            var order = 0;
            var xrange = d3.extent(data, function(d){ return d.x; });

            var p0 = [50, 10, 10, 10]; //d3.median(data, function (d) { return d.y; })];
            for (i = 1; i <= order; i++) {
                p0.push(0.0);
            }

            chi = function (p) {
                var i, chi = [];
                if (Math.abs(p[1]) > (xrange[1] - xrange[0]) ||
                    p[2] > xrange[1] || p[2] < xrange[0]) {
                    for (i = 0; i < data.length; i++) {
                        chi.push(1e10);
                    }
                }
                for (i = 0; i < data.length; i++) {
                    chi.push((data[i].y - model(p, data[i].x)[0]));
                }
                return chi;
            };
            chi2 = function (p) {
                var c = chi(p);
                return optimize.vector.dot(c, c);
            };
            p1 = optimize.newton(chi, p0);
            //p1 = optimize.fmin(chi2, p0);
            p1[2] = 0; // Centered x-axis
            p1[3] = 0; // Baseline on y=0

            var fit_data = [];
            for (i = -ground_width / 2; i <= ground_width / 2; i += ground_width / 500.) {
                fit_data.push({x: i, y: model(p1, i)[0]});
            }

            return [fit_data, p1];
        }
    });



}

window.onload = init;
