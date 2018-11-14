    /*** SET UP DATA ***/

    // index at the start, possible to change to random index at start
    var place_index = 0;
    var year_index = 0;
    // all_data[0].year[0].images[0]
    var current_year = all_data[place_index].year[year_index].year_num;
    var current_address = all_data[place_index].address;
    var zdepth_isgoingup = true;
    var collide_count_single_year = 0;
    var year_rounds_completed = 0;
    var show_year_timeout, show_address_timeout;
    var ready_to_change = true;

    /*** THREEJS ***/ 

    var fov = 70;
    var canvasWidth = 320 / 2;
    var canvasHeight = 240 / 2;
    var depthmap_width = 320;
    var depthmap_height = 240;
    var tiltSpeed = 0.1;
    var tiltAmount = 0.5;

    var perlin = new ImprovedNoise();
    var camera, scene, renderer;
    var three_mouseX = 0;
    var three_mouseY = 0;
    var windowHalfX, windowHalfY;
    var depthmap, depthmap_texture;
    var world3D;
    var geometry;
    var depthmap_canvas;
    var mirror;
    var ctx;
    var pixels;
    var noisePosn = 0;
    var wireMaterial;
    var meshMaterial;
    var container = document.querySelector('#container');
    var params;
    var title, info;


    // FN init
    function init() {

        // set video src
        $('.layer2 video').attr('src', 'media/'+all_data[place_index].place+'/'+all_data[place_index].video);
        $('.layer2 video')[0].load();
        $('.layer2 video')[0].play();

        // update and show year at the start
        update_year_num();

        setTimeout(function(){ 
            // $('.floating-button video')[0].play();
            $('.floating-button video').each(function() {
                $(this).get(0).load();
                $(this).get(0).play();
            });
        }, 2000);
        
        // stop the user getting a text cursor
        document.onselectstart = function() {
            return false;
        };

        //init control panel
        params = new WCMParams();
        gui = new dat.GUI();
        // gui.add(params, 'zoom', 0.1, 5).name('Zoom').onChange(onParamsChange);
        gui.add(params, 'mOpac', 0, 1).name('Mesh Opacity').onChange(onParamsChange);
        gui.add(params, 'wfOpac', 0, 0.025).name('Grid Opacity').onChange(onParamsChange);
        gui.add(params, 'contrast', 1, 5).name('Contrast').onChange(onParamsChange);
        gui.add(params, 'saturation', 0, 2).name('Saturation').onChange(onParamsChange);
        gui.add(params, 'zDepth', 0, 1000).name('Z Depth');
        gui.add(params, 'noiseStrength', 0, 600).name('Noise Strength');
        gui.add(params, 'noiseSpeed', 0, 0.05).name('Noise Speed');
        gui.add(params, 'noiseScale', 0, 0.1).name('Noise Scale');
        gui.add(params, 'invertZ').name('Invert Z');
        gui.close();

        //Init 3D
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 5000);
        camera.target = new THREE.Vector3(0, 0, 0);
        scene.add(camera);
        // if (window.orientation == undefined) {
        //     camera.position.z = 800;
        // } else {
        //     camera.position.z = 1200;
        // }
        if (window.innerWidth > window.innerHeight) {
            camera.position.z = 800;
        } else {
            camera.position.z = 1100;
        }

        //init depthmap texture
        depthmap = document.createElement('img');
        depthmap.width = depthmap_width;
        depthmap.height = depthmap_height;

        change_texture(true, place_index, year_index)
        // depthmap.src = 'media/'+all_data[place_index].year[year_index].images[0];
        // // depthmap_texture 
        // depthmap_texture = new THREE.TextureLoader().load( 'media/'+all_data[place_index].year[year_index].images[0] );
        // // depthmap_texture.needsUpdate = true;

        world3D = new THREE.Object3D();
        scene.add(world3D);

        //add mirror plane
        geometry = new THREE.PlaneGeometry(640, 480, canvasWidth, canvasHeight);
        geometry.dynamic = true;
        meshMaterial = new THREE.MeshBasicMaterial({
            // color:0x000000,
            opacity: 1,
            map: depthmap_texture
        });
        mirror = new THREE.Mesh(geometry, meshMaterial);
        world3D.add(mirror);

        //add wireframe plane
        wireMaterial = new THREE.MeshBasicMaterial({
            opacity: 0.05,
            color: 0xffffff,
            wireframe: true,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        var wiremirror = new THREE.Mesh(geometry, wireMaterial);
        world3D.add(wiremirror);
        wiremirror.position.z = 5;

        //init renderer
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha:true
        });
        renderer.sortObjects = false;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor( 0xffffff, 0 );

        container.appendChild(renderer.domElement);

        // add Stats
        stats = new Stats();
        document.querySelector('.fps').appendChild(stats.domElement);

        //init depthmap_canvas - used to analyze the depthmap pixels
        depthmap_canvas = document.createElement('canvas');
        document.body.appendChild(depthmap_canvas);
        depthmap_canvas.style.position = 'absolute';
        depthmap_canvas.style.display = 'none';
        ctx = depthmap_canvas.getContext('2d');

        //init listeners
        // document.addEventListener('mousemove', onMouseMove, false);
        window.addEventListener('resize', onResize, false);

        //handle WebGL context lost
        renderer.domElement.addEventListener("webglcontextlost", function(event) {
            prompt.style.display = 'inline';
            prompt.innerHTML = 'WebGL Context Lost. Please try reloading the page.';
        }, false);


        onResize();

        animate();

        setTimeout(function(){ 
            $('.loading').fadeOut() 
        }, 2000);


    };
    // END init()


    // FN change depthmap texture
    function change_texture(is_firstload, place_index, year_index) {

        var texture_to_load = 'media/'+all_data[place_index].place+'/'+all_data[place_index].year[year_index].images[0];

        if ( is_firstload ) {
            depthmap.src = texture_to_load;
            // depthmap_texture 
            depthmap_texture = new THREE.TextureLoader().load( texture_to_load );
            // depthmap_texture.needsUpdate = true;
        } else {

            // preload textures before changing
            var loader = new THREE.TextureLoader();
            // load a resource
            loader.load(
                // resource URL
                texture_to_load,
                // Function when resource is loaded
                function ( texture ) {
                    // console.log(texture)
                    // do something with the texture
                    depthmap.src = texture_to_load;
                    world3D.children[0].material.map = texture;
                    depthmap_texture.needsUpdate = true;

                    // params.zDepth = 0;
                    // zdepth_isgoingup = true;
                },
                // Function called when download progresses
                function ( xhr ) {
                    console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
                },
                // Function called when download errors
                function ( xhr ) {
                    console.log( 'An error happened' );
                }
            );

        }

    };
    // END change_texture

    //FN update year_num and flash it
    function update_year_num() {
        current_year = all_data[place_index].year[year_index].year_num;
        // $('.button3 .floating-button').html(current_year.charAt(2));
        // $('.button4 .floating-button').html(current_year.charAt(3));

        $('.year_alert span').html(current_year);
        $('.year_alert').show();
        clearTimeout(show_year_timeout);
        show_year_timeout = setTimeout(function(){ 
                                $('.year_alert').hide() 
                            }, 1000);

    };
    // END update_year_num();

    // flash address
    function update_address() {
        current_address = all_data[place_index].address

        $('.address_alert span').html(current_address);
        $('.address_alert').show();
        clearTimeout(show_address_timeout);
        show_address_timeout = setTimeout(function(){ 
                                $('.address_alert').hide() 
                            }, 1000);

    };
    // END


    // FN get next year
    function next_year() {
        if (year_index < all_data[place_index].year.length - 1) {
            year_index += 1;

        } else {
            year_index = 0;
        }

        change_texture(false, place_index, year_index);
        update_year_num();
    };
    // END next_year()


    // FN get next place 
    function next_place() {

        year_index = 0;

        setTimeout(function(){ 
            color_to("white");
        }, 600);

        if (place_index < all_data.length - 1) {
            place_index += 1;

        } else {
            place_index = 0;
        }

        change_texture(false, place_index, year_index);

        //if changing place, delay year update with timeout, 
        //so that it will only show after go_small ends
        if (can_change_year) {
            update_year_num();  
        } else {
            setTimeout(function(){ 
                update_year_num();  
            }, 1300);
        };

        $('.layer2').fadeOut(function() {
            $('.layer2 video').attr('src', 'media/'+all_data[place_index].place+'/'+all_data[place_index].video );
            $('.layer2 video')[0].load();
            $('.layer2 video')[0].play();
            $('.layer2').fadeIn();
        });

        update_address()
    }
    // END next_place();

    // FN make zdepth go crazy and then change place data
    function go_big(){
        zdepth_isgoingup = 'go_big';
        can_change_year = false;
        
        // reset collide counts
        collide_count_single_year = 0;
        year_rounds_completed = 0;

        color_to("black");

    };
    // END go_big()

    
    // FN tween material color
    function color_to(value) {

        var color = {
          "black": new THREE.MeshBasicMaterial({
            color: 0x000000
          }),
          "white": new THREE.MeshBasicMaterial({
            color: 0xffffff
          })
        };


      var initial = new THREE.Color(mirror.material.color.getHex());
      var value = new THREE.Color(color[value].color.getHex());
      TweenLite.to(initial, 1, {
        r: value.r,
        g: value.g,
        b: value.b,
        
        onUpdate: function () {
          mirror.material.color = initial;
        }
      });
    };
    // END


    //FN params for dat.gui
    function WCMParams() {
        // this.zoom = 1;
        this.mOpac = 1;
        this.wfOpac = 0.025;
        this.contrast = 1;
        this.saturation = 1;
        this.invertZ = true;
        this.zDepth = 85;
        this.noiseStrength = 200;
        this.noiseScale = 0.01;
        this.noiseSpeed = 0.02;
        //this.doSnapshot = function() {};
    };
    // END

    function onParamsChange() {
        meshMaterial.opacity = params.mOpac;
        wireMaterial.opacity = params.wfOpac;
        container.style.webkitFilter = "contrast(" + params.contrast + ") saturate(" + params.saturation + ")";
    };
    // END

    function getZDepths() {

        noisePosn += params.noiseSpeed;

        //draw webcam depthmap pixels to canvas for pixel analysis
        //double up on last pixel get because there is one more vert than pixels
        ctx.drawImage(depthmap, 0, 0, canvasWidth + 1, canvasHeight + 1);
        pixels = ctx.getImageData(0, 0, canvasWidth + 1, canvasHeight + 1).data;

        for (var i = 0; i < canvasWidth + 1; i++) {
            for (var j = 0; j < canvasHeight + 1; j++) {
                var color = new THREE.Color(getColor(i, j));
                var brightness = getBrightness(color);
                var gotoZ = params.zDepth * brightness - params.zDepth / 2;

                //add noise wobble
                gotoZ += perlin.noise(i * params.noiseScale, j * params.noiseScale, noisePosn) * params.noiseStrength;
                //invert?
                if (params.invertZ) gotoZ = -gotoZ;
                //tween to stablize
                geometry.vertices[j * (canvasWidth + 1) + i].z += (gotoZ - geometry.vertices[j * (canvasWidth + 1) + i].z) / 5;
            }
        }
        geometry.verticesNeedUpdate = true;
    };
    // END



    function animate() {
        if (depthmap.readyState === depthmap.HAVE_ENOUGH_DATA) {
            depthmap_texture.needsUpdate = false;
            getZDepths();
        }
        stats.update();
        if (py_world != undefined) {
            py_world.step( performance.now() );    
        }

        requestAnimationFrame(animate);
        render();
    };
    // END animate()

    function render() {
        // world3D.scale = new THREE.Vector3(params.zoom, params.zoom, 1);
        world3D.rotation.x += ((three_mouseY * tiltAmount) - world3D.rotation.x) * tiltSpeed;
        world3D.rotation.y += ((three_mouseX * tiltAmount) - world3D.rotation.y) * tiltSpeed;
        
        // anim zdepth
        if (params.zDepth <= 500 && zdepth_isgoingup == true) {
            can_change_year = true;
            // case 1, slowly increase zdepth from 100 to 500
            params.zDepth += 2;   
            if (params.zDepth >= 500) {
                zdepth_isgoingup = false;    
            }     

        } 
        else if(zdepth_isgoingup == false) {
            can_change_year = true;
            // case 2, slowly decrease zdepth from 500 to 100
            params.zDepth -= 2;    
            if (params.zDepth < 100) {
                zdepth_isgoingup = true;    
            }
        }
        else if(zdepth_isgoingup == "go_big") {
            // case 3, greatly increase zdepth to 2500
            // if while zdepth is overwhelming screen, change place
            params.zDepth += 20;    
            if (params.zDepth > 2500) {
                zdepth_isgoingup = "go_small";    
                next_place();
            }

            // hide year_alert when animating places
            //$('.year_alert').addClass('hide');
        }
        else if(zdepth_isgoingup == "go_small") {

            // case 3, greatly increase zdepth to 2000
            params.zDepth -= 30;    
            if (params.zDepth < 85) {
                zdepth_isgoingup = true; 
            }
        }

        // console.log(zdepth_isgoingup, params.zDepth);

        // console.log('az',three_mouseY, three_mouseX)
        //camera.lookAt(camera.target);
        renderer.render(scene, camera);
    };
    // END render()



    // FN Returns a hexidecimal color for a given pixel in the pixel array.
    function getColor(x, y) {
        var base = (Math.floor(y) * (canvasWidth + 1) + Math.floor(x)) * 4;
        var c = {
            r: pixels[base + 0],
            g: pixels[base + 1],
            b: pixels[base + 2],
            a: pixels[base + 3]
        };
        return (c.r << 16) + (c.g << 8) + c.b;
    };
    // END

    //return pixel brightness between 0 and 1 based on human perceptual bias

    function getBrightness(c) {
        return (0.34 * c.r + 0.5 * c.g + 0.16 * c.b);
    };
    // END


    //start the show
    init();




/**** PHYSICSJS ***/

    var py_world,
        viewportBounds,
        edgeBounce,
        py_renderer,
        vw_to_px,
        button1,
        button2,
        button3,
        button4;


    Physics(function (world) {

        py_world = this;
        // bounds of the window
        viewportBounds = Physics.aabb(0, 0, window.innerWidth, window.innerHeight)

        // create a renderer
        py_renderer = Physics.renderer('dom', {
            el: 'buttonsViewport',
            width: window.innerWidth,
            height: window.innerHeight,
            meta: !1
        });

        // add the renderer
        py_world.add(py_renderer);
        // render on each step
        py_world.on('step', function () {
            world.render();
        });

        
        // constrain objects to these bounds
        edgeBounce = Physics.behavior('edge-collision-detection', {
            aabb: viewportBounds,   
            restitution: 1,
            cof: 1
        });
        py_world.add(edgeBounce);


        // vw unit to px conversion
        if (window.innerWidth > window.innerHeight) {
            vw_to_px = window.innerWidth * (5 / 100);
            var v1 = 0.5
            var v2 = 0.4
            var v3 = 0.3
        } else {
            vw_to_px = window.innerWidth * (7.5 / 100);
            var v1 = 0.2
            var v2 = 0.25
            var v3 = 0.15
        }
        
        // console.log(vw_to_px)

        button1 = Physics.body('circle', {
            x: window.innerWidth / 2 - 50,
            y: window.innerHeight / 2 - 50,
            vx: v1 * -Math.random(),
            vy: v1 * Math.random(),
            radius: vw_to_px,
            cof: 0,
            restitution: 1,
            mass: 1,
            view: $(".button1")[0]
        });

        button2 = Physics.body('circle', {
            x: window.innerWidth / 2 - 50,
            y: window.innerHeight / 2 - 50,
            vx: v2 * -Math.random(),
            vy: v2 * Math.random(),
            radius: vw_to_px,
            cof: 0,
            restitution: 1,
            mass: 1,
            view: $(".button2")[0]
        });

        button3 = Physics.body('circle', {
            x: window.innerWidth / 2 - 50,
            y: window.innerHeight / 2 - 50,
            vx: v3 * -Math.random(),
            vy: v3 * Math.random(),
            radius: vw_to_px,
            cof: 0,
            restitution: 1,
            mass: 1,
            view: $(".button3")[0]
        });

        button4 = Physics.body('circle', {
            x: window.innerWidth / 2 - 50,
            y: window.innerHeight / 2 - 50,
            vx: 0.5 * -Math.random(),
            vy: 0.5 * Math.random(),
            radius: vw_to_px,
            cof: 0,
            restitution: 1,
            mass: 1,
            view: $(".button4")[0]
        });

        // create some bodies
        py_world.add( button1 );
        py_world.add( button2 );
        py_world.add( button3 );
        py_world.add( button4 );

        // add things to the world
        py_world.add(Physics.behavior('body-impulse-response'));
        py_world.add(Physics.behavior("body-collision-detection"));
        py_world.add(Physics.behavior("sweep-prune"));

        setTimeout(function(){ 

            py_world.on('collisions:detected', function( data ){

                var t = data.collisions[0].bodyA.view,
                    i = data.collisions[0].bodyB.view;

                 if (t != null && i != null) {
                    console.log('cc:', collide_count_single_year, 'yrc:', year_rounds_completed, 'yl:', all_data[place_index].year.length)

                    // count how many times this place's year data set has been looped
                    if (can_change_year) {
                        collide_count_single_year += 1;    
                    }
                    
                    if ( collide_count_single_year > (all_data[place_index].year.length - 1) && can_change_year) {
                        console.log('YYYY', zdepth_isgoingup)
                        collide_count_single_year = 0;
                        year_rounds_completed += 1;
                    }   


                    // only get next year data if the place data has been looped less than 4 time
                    if (year_rounds_completed <= 1 && can_change_year) {
                        // change year on each collide
                        next_year();

                        // if ($('.floating-button').hasClass('bg1')) {
                        //     $('.floating-button').removeClass('bg1');
                        //     $('.floating-button').addClass('bg2');

                        //     $('#buttonsViewport').removeClass('bg1');
                        //     $('#buttonsViewport').addClass('bg2');
                        // } 
                        // else if ($('.floating-button').hasClass('bg2')) {
                        //     $('.floating-button').removeClass('bg2');
                        //     $('.floating-button').addClass('bg3');

                        //     $('#buttonsViewport').removeClass('bg2');
                        //     $('#buttonsViewport').addClass('bg3');
                        // }
                        // else if ($('.floating-button').hasClass('bg3')) {
                        //     $('.floating-button').removeClass('bg3');
                        //     $('.floating-button').addClass('bg4');

                        //     $('#buttonsViewport').removeClass('bg3');
                        //     $('#buttonsViewport').addClass('bg4');
                        // }  
                        // else if ($('.floating-button').hasClass('bg4')) {
                        //     $('.floating-button').removeClass('bg4');
                        //     $('.floating-button').addClass('bg1');

                        //     $('#buttonsViewport').removeClass('bg4');
                        //     $('#buttonsViewport').addClass('bg1');
                        // }                        
                    } 
                    // if place data has been looped more than 4 times, get next place
                    else if (can_change_year) {
                        go_big()
                    }


                 }

            });
             

        }, 1000);


    });


    // FN resize event
    function onResize() {
        // threejs resize events
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        windowHalfX = window.innerWidth / 2;
        windowHalfY = window.innerHeight / 2;

        // if ( window.innerWidth < 600) {
        //     camera.position.z = 1200;
        // } else {
        //     camera.position.z = 800;
        // }
        if (window.innerWidth > window.innerHeight) {
            camera.position.z = 800;
        } else {
            camera.position.z = 1100;
        }

        // PHYSICSJS resize events
        // as of 0.7.0 the renderer will auto resize. so we just take the values from the renderer
        if (py_world != undefined) {
            if (window.innerWidth > window.innerHeight) {
                vw_to_px = window.innerWidth * (5 / 100);
            } else {
                vw_to_px = window.innerWidth * (7.5 / 100);
            }
            //console.log(vw_to_px)

            py_renderer.el.width = window.innerWidth;
            py_renderer.el.height = window.innerHeight;

            viewportBounds = Physics.aabb(0, 0, window.innerWidth, window.innerHeight);
            // update the boundaries
            edgeBounce.setAABB(viewportBounds);    

            button1.geometry.radius = vw_to_px;
            button2.geometry.radius = vw_to_px;
            button3.geometry.radius = vw_to_px;     
            button4.geometry.radius = vw_to_px;                  
        }

    };
    // END onResize()





    // MOUSE / GYRO INTERACTIONS
    if (window.orientation == undefined) {
            
        var vw_size = 65;

        $(document).mousemove(function(getCurrentPos, event){
            /* the following offset is half of width of image, currently 25vw */
            var offset = (100 - vw_size) / 2;
            var xCord = getCurrentPos.pageX;
            //var yCord = getCurrentPos.pageY;

            xPercent = ( xCord / $( document ).width() * 100 ) - offset;
            //yPercent = yCord / $( document ).height() * 100;
            //console.log(xPercent)

            // console.log('aa', getCurrentPos);


            if ( xPercent < 0  ){
                    
                $('.layer2').css('transform', 'translateX(' + 0 + 'vw)');
                $('.layer2 .inner_wrap').css('transform', 'translateX(-' + 0 + 'vw)'); 

            }   else if ( xPercent > vw_size) {
                
                $('.layer2').css('transform', 'translateX(' + vw_size + 'vw)');
                $('.layer2 .inner_wrap').css('transform', 'translateX(-' + vw_size + 'vw)'); 

            }   else {

                $('.layer2').css('transform', 'translateX(' + xPercent + 'vw)');
                $('.layer2 .inner_wrap').css('transform', 'translateX(-' + xPercent + 'vw)'); 

            }


            // values for tilting threejs with mouse
            three_mouseX = (getCurrentPos.clientX - windowHalfX) / (windowHalfX);
            three_mouseY = (getCurrentPos.clientY - windowHalfY) / (windowHalfY);

        }); /* end mousemove. */


    } else {


      window.addEventListener('deviceorientation', function(e) {

        var alpha  = event.alpha;
        var gamma  = event.gamma;

        // shift left/right video mask according to device orientation
        var converted_val = ((gamma - -100) * 100) / (100 - -100);
        //console.log('a:'+gamma, converted_val)
        $('.layer2').css('transform', 'translateX(' + (converted_val - 15) + 'vw)');
        $('.layer2 .inner_wrap').css('transform', 'translateX(-' + (converted_val - 15) + 'vw)'); 


        // values for tilting left/right up/down threejs with device orientation
        three_mouseX = event.gamma / 50;
        three_mouseY = (event.beta / 50) - 1;
        // console.log('ay1',event.beta / 50)

      });


    };
    // END MOUSEMOVE / GYRO 



    $('.about_trigger').click(function() {
        $('.about').show();
    });

    $('.about_close').click(function() {
        $('.about').hide();
    });
