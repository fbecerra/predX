function init() {

    var scale = chroma.scale(['green', 'white']);
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


    var disk = addDisk();
    current_disk = 0;

    // add the disk to the scene
    scene.add(disk);

    // position and point the camera to the center of the scene
    camera.position.set(0, 80, 100);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // Light
    light = new THREE.SpotLight(0xFFFFFF);
    light.position.set(20, 100, 50);
    scene.add(light);

    // add the output of the renderer to the html element
    document.getElementById("viewport").appendChild(webGLRenderer.domElement);

    // Create ground
    var ground_material = Physijs.createMaterial(
        new THREE.MeshPhongMaterial({map: THREE.ImageUtils.loadTexture('assets/textures/wood-2.jpg')}),
        .9, .3);

    var ground = new Physijs.BoxMesh(new THREE.BoxGeometry(60, 1, 80), ground_material, 0);
    ground.position.z = -20;
    ground.position.y = 0;
    scene.add(ground);

    /*var borderLeft = new Physijs.BoxMesh(new THREE.BoxGeometry(2, 3, 60), ground_material, 0);
    borderLeft.position.x = -31;
    borderLeft.position.y = 2;
    scene.add(borderLeft);

    var borderRight = new Physijs.BoxMesh(new THREE.BoxGeometry(2, 3, 60), ground_material, 0);
    borderRight.position.x = 31;
    borderRight.position.y = 2;
    scene.add(borderRight);

    var borderBottom = new Physijs.BoxMesh(new THREE.BoxGeometry(64, 3, 2), ground_material, 0);
    borderBottom.position.z = 30;
    borderBottom.position.y = 2;
    scene.add(borderBottom);*/

    var borderTop = new Physijs.BoxMesh(new THREE.BoxGeometry(64, 3, 2), ground_material, 0);
    borderTop.position.z = -40;
    borderTop.position.y = 2;
    scene.add(borderTop);

    var n_piles = Math.round(60 / (2 * 4)); // borderTopLength / 2 * diskRadius
    for (var disk_piles = []; disk_piles.length < n_piles; disk_piles.push([]));

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
            current_vel = disk.getLinearVelocity();
            disk.setLinearVelocity(new THREE.Vector3(current_vel.x + ran_number, 0, -controls.velocity));

            // collision
            var originPoint = disk.position.clone();
            for (var vertexIndex = 0; vertexIndex < disk.geometry.vertices.length; vertexIndex++) {
                var localVertex = disk.geometry.vertices[vertexIndex].clone();
                var globalVertex = localVertex.applyMatrix4(disk.matrix);
                var directionVector = globalVertex.sub(disk.position);
                var ray = new THREE.Raycaster(originPoint, directionVector.clone().normalize());
                var collisionResults = ray.intersectObjects([borderTop]);
                if (collisionResults.length > 0 && collisionResults[0].distance < directionVector.length()) {

                    // if we've got a hit, we just stop the disk and move it behind the wall
                    console.log('hit');
                    disk.setLinearVelocity(new THREE.Vector3(0, 0, 0));

                    // Move to pile
                    var pile_idx = Math.floor(disk.position.x / n_piles) + n_piles / 2;
                    var this_pile = disk_piles[pile_idx];
                    var new_ypos = this_pile.length * 2 + 1.5; // diskPiles[idx] * diskHeight + diskInitialPosY
                    var new_xpos = Math.floor(disk.position.x / n_piles) * 8 + 4; // floor(x/piles) + diskRadius

                    disk.rotation.set(0, 0, 0);
                    disk.position.set(new_xpos, new_ypos, -50);
                    disk.matrixAutoUpdate  = false;
                    disk.updateMatrix();

                    this_pile.push(disk);
                    current_disk += 1;
                    //console.log(disk_piles);

                    // Add another disk
                    if (current_disk < max_disks) {
                        disk = addDisk();

                        // add the disk to the scene
                        scene.add(disk);
                        console.log(current_disk);
                    } else {
                        // We add curve
                        var points = disk_piles.map(function(d, idx){
                            return {x: (idx-4)*2*4+4, y: d.length * 2, z: -50};
                        });
                        var lines = new THREE.Geometry();
                        var colors = [], i = 0;
                        points.forEach(function (e) {
                            lines.vertices.push(new THREE.Vector3(e.x, e.y, e.z));
                            colors[i] = new THREE.Color(0xffffff);
                            colors[i].setHSL(1.0, 1.0, 1.0);
                            i++;
                        });
                        lines.colors = colors;
                        var material = new THREE.LineBasicMaterial({
                            opacity: 1.0,
                            linewidth: 8,
                            vertexColors: THREE.VertexColors });
                        var line = new THREE.Line(lines, material);
                        line.position.set(0, 1.5, 0);
                        scene.add(line);
                        console.log(line)

                    }
                }
            }
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
    disk.position.set(0,1.5,0);
    disk.__dirtyPosition = true;

    return disk;
}

window.onload = init;