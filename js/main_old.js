'use strict';

var scale = chroma.scale(['green', 'white']);

Physijs.scripts.worker = 'js/physijs_worker.js';
Physijs.scripts.ammo = 'ammo.js';

var initScene, render, applyForce, setMousePosition, mouse_position,
    ground_material, box_material,
    renderer, render_stats, scene, ground, light, camera, box, boxes = [];

initScene = function () {

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.setClearColor(new THREE.Color(0x000000));
    document.getElementById('viewport').appendChild(renderer.domElement);

    render_stats = new Stats();
    render_stats.domElement.style.position = 'absolute';
    render_stats.domElement.style.top = '1px';
    render_stats.domElement.style.zIndex = 100;
    document.getElementById('viewport').appendChild(render_stats.domElement);

    scene = new Physijs.Scene;
    scene.setGravity(new THREE.Vector3(0, -50, 0));

    camera = new THREE.PerspectiveCamera(
        35,
        window.innerWidth / window.innerHeight,
        1,
        1000
    );
    camera.position.set(50, 30, 50);
    camera.lookAt(new THREE.Vector3(10, 0, 10));
    scene.add(camera);

    // Light
    light = new THREE.SpotLight(0xFFFFFF);
    light.position.set(20, 100, 50);


    scene.add(light);

    createGround();

    var meshes = [];


    requestAnimationFrame(render);

    var controls = new function () {
        this.gravityX = 0;
        this.gravityY = -50;
        this.gravityZ = 0;
        this.sphereRestitution = 0.9;
        this.sphereFriction = 0.1;


        this.resetScene = function () {

            scene.setGravity(new THREE.Vector3(controls.gravityX, controls.gravityY, controls.gravityZ));
            meshes.forEach(function (e) {
                scene.remove(e);
            });
            meshes = [];

            var colorSphere = scale(Math.random()).hex();

            box = new Physijs.SphereMesh(
                new THREE.SphereGeometry(2, 20),
                Physijs.createMaterial(
                    new THREE.MeshPhongMaterial(
                        {
                            color: colorSphere,
                            opacity: 0.8,
                            transparent: true
//                                                        map: THREE.ImageUtils.loadTexture( '../assets/textures/general/floor-wood.jpg' )
                        }),
                    controls.sphereFriction,
                    controls.sphereRestitution
                )
            );
            box.position.set(
                Math.random() * 50 - 25,
                0,
                //20 + Math.random() * 5,
                Math.random() * 50 - 25
            );
            box.setLinearVelocity(new THREE.Vector3(100, 0, 0));
            console.log(box)
            meshes.push(box);
            scene.add(box);


        };
    };

    var gui = new dat.GUI();
    gui.add(controls, 'gravityX', -100, 100);
    gui.add(controls, 'gravityY', -100, 100);
    gui.add(controls, 'gravityZ', -100, 100);
    gui.add(controls, 'sphereRestitution', 0, 1);
    gui.add(controls, 'sphereFriction', 0, 1);
    gui.add(controls, 'initial velocity', -10, 10).onChange(controls.changeVelocity);

    gui.add(controls, 'resetScene');

    controls.resetScene();
};

var stepX;

render = function () {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
    render_stats.update();

    scene.simulate(undefined, 1);


};



function createGround() {
    var ground_material = Physijs.createMaterial(
        new THREE.MeshPhongMaterial({map: THREE.ImageUtils.loadTexture('assets/textures/wood-2.jpg')}),
        .9, .3);

    var ground = new Physijs.BoxMesh(new THREE.BoxGeometry(60, 1, 60), ground_material, 0);

    var borderLeft = new Physijs.BoxMesh(new THREE.BoxGeometry(2, 3, 60), ground_material, 0);
    borderLeft.position.x = -31;
    borderLeft.position.y = 2;
    ground.add(borderLeft);

    var borderRight = new Physijs.BoxMesh(new THREE.BoxGeometry(2, 3, 60), ground_material, 0);
    borderRight.position.x = 31;
    borderRight.position.y = 2;
    ground.add(borderRight);

    var borderBottom = new Physijs.BoxMesh(new THREE.BoxGeometry(64, 3, 2), ground_material, 0);
    borderBottom.position.z = 30;
    borderBottom.position.y = 2;
    ground.add(borderBottom);

    var borderTop = new Physijs.BoxMesh(new THREE.BoxGeometry(64, 3, 2), ground_material, 0);
    borderTop.position.z = -30;
    borderTop.position.y = 2;
    ground.add(borderTop);

    scene.add(ground);
}


window.onload = initScene;