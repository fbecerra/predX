function init() {

    var frame_id;

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
        current_vel,
        disks= 5,
        max_disks = 10;

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

    var n_piles = Math.round(60 / (2 * 4)); // borderTopLength / 2 * diskRadius
    for (var disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
    var points = disk_piles.map(function(d, idx){
        return {x: (idx-4)*2*4+4, y: d.length, z: -50};
    });
    var histogram =  new Histogram(),
        plot = new Plot(),
        offsets = [];
    histogram.init(points);
    plot.init(points.length, max_disks);

    var handleCollision = function(object, linearVelocity, angularVelocity){

        object.setLinearVelocity(new THREE.Vector3(0, 0, 0));

        // Move to pile
        var pile_idx = Math.floor(object.position.x / n_piles) + n_piles / 2;
        var this_pile = disk_piles[pile_idx];
        var new_ypos = this_pile.length * 2 + 1.5; // diskPiles[idx] * diskHeight + diskInitialPosY
        var new_xpos = Math.floor(object.position.x / n_piles) * 8 + 4; // floor(x/piles) + diskRadius

        object.rotation.set(0, 0, 0);
        object.position.set(new_xpos, new_ypos, -60);
        object.matrixAutoUpdate  = false;
        object.updateMatrix();

        this_pile.push(object);
        scene.remove(object);

        // Update histogram
        points = disk_piles.map(function(d, idx){
            return {x: (idx-4)*2*4+4, y: d.length, z: -50};
        });
        histogram.update(points);

        current_disk += 1;

        // Add another disk
        if (current_disk < disks) {
            disk = addDisk();
            scene.add(disk);
        } else {
            // Fit gaussian, get offset. In the meantime offset is the maximum.
            var offsetMax = d3.max(points, function(d){return d.y; });
            offsets.push({pucks: disks, offset: offsetMax});
            plot.update(offsets);
        }
        

    };

    var border_material = Physijs.createMaterial(
        new THREE.MeshPhongMaterial({map: loader.load('assets/textures/wood-3.jpg'), opacity: 0.9}),
        .0, .3);
    var borderTop = new Physijs.BoxMesh(new THREE.BoxGeometry(64, 60, 2), border_material, 0);
    borderTop.position.z = -60;
    borderTop.position.y = -18;
    borderTop.addEventListener( 'collision', handleCollision);
    scene.add(borderTop);

    // call the render function
    var step = 0;

    // setup the control gui
    var controls = new function () {

        this.diskRestitution = 1.0;
        this.diskFriction = 0.5;
        this.velocity = 50;
        this.numberPucks = 5;

        this.redraw = function () {

            // Restart piles
            for (disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));
            points = disk_piles.map(function(d, idx){
                return {x: (idx-4)*2*4+4, y: d.length, z: -50};
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
            disk.position.set(0,-18.5,0);
            disk.__dirtyPosition = true;
            // add it to the scene and to the array of disks.
            scene.add(disk);

            disks = controls.numberPucks;
            render();

        };
    };

    var gui = new dat.GUI();
    gui.add(controls, 'diskRestitution', 0, 1).onChange(controls.redraw);
    gui.add(controls, 'diskFriction', 0, 1).onChange(controls.redraw);
    gui.add(controls, 'velocity', 0, 100).onChange(controls.redraw);
    gui.add(controls, 'numberPucks', 0, 10).step(1).onChange(controls.redraw);

    render();

    function render() {
        stats.update();

        if (current_disk < disks) {

            // motion
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
    disk.position.set(0,-18.5,15);
    disk.__dirtyPosition = true;

    return disk;
}

function Histogram(){

    this.margin = {top: 40, right: 40, bottom: 40, left: 50};
    this.width = 400;
    this.height = 300;

    this.div = d3.select("#viewport");

    this.svg = this.div.append("svg")
        .attr("id", "histogram")
        .attr("width", this.width + this.margin.left + this.margin.right)
        .attr("height", this.height + this.margin.top + this.margin.bottom)
        .style("position", "absolute")
        .style("left", window.innerWidth/2 - this.width/2 - 2*this.margin.left + this.margin.right)
        .style("top", 0);

    this.g = this.svg.append("g")
        .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

    this.x = d3.scaleBand().range([0, this.width]).padding(0.1);
    this.y = d3.scaleLinear().range([this.height, 0]);

    this.init = function(data){

        this.x.domain(d3.range(data.length));
        this.y.domain([0, 10]); // disks

        var that = this;

        this.g.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + this.height + ")")
            .call(d3.axisBottom(this.x));
        this.g.append("g")
            .attr("class", "axis axis--y")
            .attr("transform", "translate("+this.width/2+",0)")
            .call(d3.axisLeft(this.y));
        this.g.selectAll("rect")
            .data(data)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("fill", "white")
            .attr("x", function(d, i) { return that.x(i); })
            .attr("y", function(d) { return that.y(d.y); })
            .attr("width", this.x.bandwidth())
            .attr("height", function(d) { return that.height - that.y(d.y); });

    };

    this.update = function(data){

        var that = this;

        this.selection = this.g.selectAll(".bar")
            .data(data);

        this.selection.exit().remove();

        this.selection.attr("class", "bar")
            .attr("y", function(d) { return that.y(d.y); })
            .attr("height", function(d) { return that.height - that.y(d.y); });

        this.selection.enter().append("rect")
            .attr("class", "bar")
            .attr("y", function(d) { return that.y(d.y); })
            .attr("height", function(d) { return that.height - thaty(d.y); });

    };
}


function Plot(){

    this.margin = {top: 40, right: 40, bottom: 40, left: 50};
    this.width = 400;
    this.height = 300;

    this.div = d3.select("#viewport");

    this.svg = this.div.append("svg")
        .attr("id", "plot")
        .attr("width", this.width + this.margin.left + this.margin.right)
        .attr("height", this.height + this.margin.top + this.margin.bottom)
        .style("position", "absolute")
        .style("left", window.innerWidth*2/3)
        .style("top",  window.innerHeight/2 - this.height/2 - 2*this.margin.top + this.margin.bottom);

    this.g = this.svg.append("g")
        .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

    this.x = d3.scaleLinear().range([0, this.width]);
    this.y = d3.scaleLinear().range([this.height, 0]);
    this.line = d3.line();

    this.init = function(points, max_disks){

        this.x.domain([0, max_disks]);
        this.y.domain([0, max_disks]); // disks
        
        this.g.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + this.height + ")")
            .call(d3.axisBottom(this.x));
        this.g.append("g")
            .attr("class", "axis axis--y")
            .attr("transform", "translate(0,0)")
            .call(d3.axisLeft(this.y));
        this.g.append("g")
            .datum([]).append("path")
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 1.5);

    };

    this.update = function(data){

        var that = this;

        this.line.x(function(d) { return that.x(d.pucks) })
            .y(function(d){ return that.y(d.offset) });

        this.selection = this.g.selectAll(".line")
            .datum(data)
            .attr("d", this.line);

    };
}

window.onload = init;
