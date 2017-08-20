function init() {

    var frame_id;

    var current_vel, current_disk, max_disks=5;

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
    webGLRenderer.setClearColor(new THREE.Color(0x000000));
    webGLRenderer.setSize(window.innerWidth, window.innerHeight);

    var disk = addDisk(),
        disks = [disk],
        current_disk = 0;

    // add the disk to the scene
    scene.add(disk);

    // position and point the camera to the center of the scene
    camera.position.set(0, 60, 100);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Light
    light = new THREE.SpotLight(0xFFFFFF);
    light.position.set(20, 80, 50);
    scene.add(light);

    // add the output of the renderer to the html element
    document.getElementById("viewport").appendChild(webGLRenderer.domElement);

    // Create ground
    var loader = new THREE.TextureLoader();
    var ground_material = Physijs.createMaterial(
        new THREE.MeshPhongMaterial({map: loader.load('assets/textures/wood-2.jpg')}),
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
    initPlot(points);


    var handleCollision = function(object, linearVelocity, angularVelocity){

        console.log('hit')
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
        scene.remove(object)
        current_disk += 1;

        // Add another disk
        if (current_disk < max_disks) {

            disks[current_disk] = addDisk();

            // add the disk to the scene
            scene.add(disks[current_disk]);
        }

        // We add curve
        points = disk_piles.map(function(d, idx){
            return {x: (idx-4)*2*4+4, y: d.length, z: -50};
        });
        updatePlot(points);

    };

    var borderTop = new Physijs.BoxMesh(new THREE.BoxGeometry(64, 3, 2), ground_material, 0);
    borderTop.position.z = -40;
    borderTop.position.y = -18;
    borderTop.addEventListener( 'collision', handleCollision);
    scene.add(borderTop);

    // call the render function
    var step = 0;

    // setup the control gui
    var controls = new function () {
        // we need the first child, since it's a multimaterial
        this.diskRestitution = 1.0;
        this.diskFriction = 0.5;
        this.velocity = 50;

        this.redraw = function () {

            // Remove disks from scene
            disk_piles.forEach(function(pile){
                pile.forEach(function(this_disk){
                    scene.remove(this_disk);
                });
            });
            // Restart piles
            for (disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));

            // Create a new one
            current_disk = 0;
            disk_material = Physijs.createMaterial(
                new THREE.MeshLambertMaterial({color: 0x444444, opacity: 0.9, transparent: true}),
                controls.diskRestitution, // high friction
                controls.diskFriction // medium restitution
            );

            disk_geometry = new THREE.CylinderGeometry(4, 4, 2, 10);
            disk = new Physijs.CylinderMesh(
                disk_geometry,
                disk_material,
                100
            );
            disk.position.set(0,1.25,0);
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

    render();

    function render() {
        stats.update();

        if (current_disk < max_disks) {

            // motion
            var min = -5, max = 5;
            var ran_number = Math.random() * (max - min) + min;
            current_vel = disks[current_disk].getLinearVelocity();
            disks[current_disk].setLinearVelocity(new THREE.Vector3(current_vel.x + ran_number, 0, -controls.velocity));

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
        new THREE.MeshLambertMaterial({color: 0x444444, opacity: 0.9, transparent: true}),
        1.0, // high friction
        .5 // medium restitution
    );

    var disk_geometry = new THREE.CylinderGeometry(4, 4, 2, 10);
    var disk = new Physijs.CylinderMesh(
        disk_geometry,
        disk_material,
        100
    );
    disk.position.set(0,-18.5,0);
    disk.__dirtyPosition = true;

    return disk;
}

var	margin = {top: 40, right: 40, bottom: 40, left: 50},
    width = 400;
    height = 300;

var x = d3.scaleBand().range([0, width]).padding(0.1),
    y = d3.scaleLinear().range([height, 0]);

var div = d3.select("#viewport");

var svg = div.append("svg")
    .attr("id", "histogram")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .style("position", "absolute")
    .style("left", window.innerWidth/2 - width/2 - 2*margin.left + margin.right)
    .style("top", 0);

var g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

function initPlot(data){

    x.domain(d3.range(data.length));
    //y.domain([0, d3.max(data, function(d) { return d.y; })]); //max_disks
    y.domain([0, 10]); // max_disks

    g.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));
    g.append("g")
        .attr("class", "axis axis--y")
        .attr("transform", "translate("+width/2+",0)")
        .call(d3.axisLeft(y));
    g.selectAll("rect")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("fill", "white")
        .attr("x", function(d, i) { return x(i); })
        .attr("y", function(d) { return y(d.y); })
        .attr("width", x.bandwidth())
        .attr("height", function(d) { return height - y(d.y); });

}

function updatePlot(data){

    var selection = g.selectAll(".bar")
        .data(data);

    selection.exit().remove();

    selection.attr("class", "bar")
        .attr("y", function(d) { console.log(y(d.y)); return y(d.y); })
        .attr("height", function(d) { return height - y(d.y); });

    selection.enter().append("rect")
        .attr("class", "bar")
        .attr("y", function(d) { console.log(y(d.y)); return y(d.y); })
        .attr("height", function(d) { return height - y(d.y); });



}

window.onload = init;