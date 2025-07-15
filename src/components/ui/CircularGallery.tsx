"use client";

import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from "ogl";
import { useEffect, useRef } from "react";

import "./CircularGallery.css";

// OGL types are not available, so we use 'any'
type OGL_Renderer = any;
type OGL_Camera = any;
type OGL_Transform = any;
type OGL_Plane = any;
type OGL_Mesh = any;
type OGL_Program = any;
type OGL_Texture = any;
type OGL_Vec2 = [number, number];
type OGL_Vec3 = [number, number, number];

// --- Utility Functions ---

function debounce(func: (this: any, ...args: any[]) => void, wait: number) {
  let timeout: NodeJS.Timeout;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function lerp(p1: number, p2: number, t: number) {
  return p1 + (p2 - p1) * t;
}

function autoBind(instance: any) {
  const proto = Object.getPrototypeOf(instance);
  Object.getOwnPropertyNames(proto).forEach((key) => {
    if (key !== "constructor" && typeof instance[key] === "function") {
      instance[key] = instance[key].bind(instance);
    }
  });
}

function createTextTexture(gl: any, text: string, font = "bold 30px Figtree", color = "#ffffff") {
  // Robust font size extraction
  const extractFontSize = (fontString: string): number => {
    // Match patterns like "30px", "bold 30px", "30pt", etc.
    const sizeMatch = fontString.match(/(\d+(?:\.\d+)?)(px|pt|em|rem|%)/i);
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toLowerCase();
      
      // Convert to pixels (approximate conversions)
      switch (unit) {
        case 'pt': return size * 1.333; // 1pt = 1.333px
        case 'em': return size * 16;    // 1em = 16px (default)
        case 'rem': return size * 16;   // 1rem = 16px (default)
        case '%': return size * 0.16;   // Rough approximation
        default: return size;           // px
      }
    }
    
    // Fallback to default size
    console.warn(`Could not parse font size from: "${fontString}", using default 30px`);
    return 30;
  };

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  
  if (!context) {
    console.error("Failed to get 2D context for text texture");
    return { texture: null, width: 0, height: 0 };
  }
  
  // Set font first to get accurate measurements
  context.font = font;
  
  // Robust text measurement
  const metrics = context.measureText(text);
  const fontSize = extractFontSize(font);
  
  // Calculate dimensions with proper validation
  const textWidth = Math.max(Math.ceil(metrics.width), 1);
  const textHeight = Math.max(Math.ceil(fontSize * 1.4), 1); // 1.4 for line height
  const padding = Math.max(Math.ceil(fontSize * 0.2), 4); // Dynamic padding
  
  // Set canvas dimensions with validation
  canvas.width = Math.max(textWidth + (padding * 2), 1);
  canvas.height = Math.max(textHeight + (padding * 2), 1);
  
  // Validate final dimensions
  if (canvas.width <= 0 || canvas.height <= 0) {
    console.error(`Invalid canvas dimensions: ${canvas.width}x${canvas.height} for text: "${text}"`);
    return { texture: null, width: 0, height: 0 };
  }
  
  // Re-set font after canvas resize (canvas resize clears all styles)
  context.font = font;
  context.fillStyle = color;
  context.textBaseline = "middle";
  context.textAlign = "center";
  
  // Clear canvas and draw text
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  // Add text shadow for better visibility
  context.shadowColor = "rgba(0, 0, 0, 0.5)";
  context.shadowBlur = 2;
  context.shadowOffsetX = 1;
  context.shadowOffsetY = 1;
  
  // Draw the text
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Create texture with comprehensive error handling
  try {
    const texture = new Texture(gl, { 
      generateMipmaps: false,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR
    });
    
    // Final validation before assigning
    if (canvas.width > 0 && canvas.height > 0) {
      texture.image = canvas;
      return { texture, width: canvas.width, height: canvas.height };
    } else {
      console.error(`Final validation failed for canvas: ${canvas.width}x${canvas.height}`);
      return { texture: null, width: 0, height: 0 };
    }
  } catch (error) {
    console.error("Failed to create WebGL texture:", error);
    return { texture: null, width: 0, height: 0 };
  }
}


// --- Classes ---

class Title extends Mesh {
  constructor(gl: any, text: string, font = "bold 30px Figtree", color = "#ffffff") {
    // Validate inputs
    if (!text || text.trim() === "") {
      text = "Untitled";
    }
    
    const textureData = createTextTexture(gl, text, font, color);
    
    // Handle case where texture creation failed
    if (!textureData.texture) {
      console.warn(`Failed to create texture for text: "${text}", using fallback`);
      
      // Create a simple colored rectangle as fallback
      super(gl, {
        geometry: new Plane(gl, { width: 2, height: 0.5 }),
        program: new Program(gl, {
          vertex: `
            attribute vec2 uv;
            attribute vec2 position;
            uniform mat4 modelViewMatrix;
            uniform mat4 projectionMatrix;
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 0.0, 1.0);
            }
          `,
          fragment: `
            precision mediump float;
            uniform vec3 uColor;
            varying vec2 vUv;
            void main() {
              // Create a simple gradient or solid color
              float alpha = 0.8;
              gl_FragColor = vec4(uColor, alpha);
            }
          `,
          uniforms: {
            uColor: { value: [1.0, 1.0, 1.0] }, // White fallback
          },
        }),
      });
      return;
    }

    const { texture, width, height } = textureData;
    
    // Calculate proper aspect ratio and size
    const aspectRatio = width / height;
    const displayWidth = Math.min(aspectRatio * 0.8, 3); // Limit max width
    const displayHeight = displayWidth / aspectRatio;

    super(gl, {
      geometry: new Plane(gl, { 
        width: displayWidth, 
        height: displayHeight,
        widthSegments: 1,
        heightSegments: 1
      }),
      program: new Program(gl, {
        vertex: `
          attribute vec2 uv;
          attribute vec2 position;
          uniform mat4 modelViewMatrix;
          uniform mat4 projectionMatrix;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 0.0, 1.0);
          }
        `,
        fragment: `
          precision mediump float;
          uniform sampler2D tMap;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            vec4 textColor = texture2D(tMap, vUv);
            
            // Ensure text is visible by boosting alpha
            if (textColor.a < 0.1) {
              discard;
            }
            
            gl_FragColor = vec4(textColor.rgb, textColor.a * uOpacity);
          }
        `,
        uniforms: {
          tMap: { value: texture },
          uOpacity: { value: 1.0 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    });
  }
}

class Media {
  extra: number;
  geometry: OGL_Plane;
  gl: any;
  image: string;
  index: number;
  length: number;
  renderer: OGL_Renderer;
  scene: OGL_Transform;
  screen: { width: number, height: number };
  text: string;
  viewport: { width: number, height: number };
  bend: number;
  textColor: string;
  borderRadius: number;
  font: string;
  program!: OGL_Program;
  plane!: OGL_Mesh;
  title!: Title;
  speed: number = 0;
  isBefore: boolean = false;
  isAfter: boolean = false;
  x: number = 0;
  width: number = 0;
  widthTotal: number = 0;
  padding: number = 0;
  scale: number = 0;

  constructor({
    geometry,
    gl,
    image,
    index,
    length,
    renderer,
    scene,
    screen,
    text,
    viewport,
    bend,
    textColor,
    borderRadius = 0,
    font,
  }: {
    geometry: OGL_Plane,
    gl: any,
    image: string,
    index: number,
    length: number,
    renderer: OGL_Renderer,
    scene: OGL_Transform,
    screen: { width: number, height: number },
    text: string,
    viewport: { width: number, height: number },
    bend: number,
    textColor: string,
    borderRadius: number,
    font: string
  }) {
    autoBind(this);
    this.extra = 0;
    this.geometry = geometry;
    this.gl = gl;
    this.image = image;
    this.index = index;
    this.length = length;
    this.renderer = renderer;
    this.scene = scene;
    this.screen = screen;
    this.text = text;
    this.viewport = viewport;
    this.bend = bend;
    this.textColor = textColor;
    this.borderRadius = borderRadius;
    this.font = font;
    this.createShader();
    this.createMesh();
    this.createTitle();
    this.onResize();
  }

  createShader() {
    const texture = new Texture(this.gl, { generateMipmaps: false });
    this.program = new Program(this.gl, {
      depthTest: false,
      depthWrite: false,
      vertex: `
        precision highp float;
        attribute vec3 position;
        attribute vec2 uv;
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec3 p = position;
          p.z = (sin(p.x * 4.0 + uTime) * 1.5 + cos(p.y * 2.0 + uTime) * 1.5) * (0.1 + uSpeed * 0.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragment: `
        precision highp float;
        uniform vec2 uImageSizes;
        uniform vec2 uPlaneSizes;
        uniform sampler2D tMap;
        uniform float uBorderRadius;
        varying vec2 vUv;
        
        float roundedBoxSDF(vec2 p, vec2 b, float r) {
          vec2 d = abs(p) - b;
          return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
        }
        
        void main() {
          vec2 ratio = vec2(
            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
          );
          vec2 uv = vec2(
            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
          );
          vec4 color = texture2D(tMap, uv);
          
          float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
          if(d > 0.0) {
            discard;
          }
          
          gl_FragColor = vec4(color.rgb, 1.0);
        }
      `,
      uniforms: {
        tMap: { value: texture },
        uPlaneSizes: { value: [0, 0] },
        uImageSizes: { value: [0, 0] },
        uSpeed: { value: 0 },
        uTime: { value: 100 * Math.random() },
        uBorderRadius: { value: this.borderRadius },
      },
      transparent: true,
    });
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = this.image;
    img.onload = () => {
      texture.image = img;
      if (this.program.uniforms.uImageSizes) {
        this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
      }
    };
  }

  createMesh() {
    this.plane = new Mesh(this.gl, {
      geometry: this.geometry,
      program: this.program,
    });
    this.plane.setParent(this.scene);
  }

  createTitle() {
    try {
      // Validate text input
      const displayText = this.text && this.text.trim() !== "" ? this.text : `Scene ${this.index + 1}`;
      
      this.title = new Title(this.gl, displayText, this.font, this.textColor);
      
      // Position the title below the plane with validation
      if (this.plane && this.plane.scale) {
        const textHeight = Math.max(this.plane.scale.y * 0.15, 0.1);
        const yOffset = Math.max(this.plane.scale.y * 0.5 + textHeight * 0.5 + 0.05, 0.1);
        
        this.title.scale.set(textHeight, textHeight, 1);
        this.title.position.y = -yOffset;
        this.title.setParent(this.plane);
      } else {
        console.warn("Plane not properly initialized for title positioning");
        // Fallback positioning
        this.title.scale.set(0.1, 0.1, 1);
        this.title.position.y = -0.5;
        this.title.setParent(this.plane);
      }
    } catch (error) {
      console.error("Error creating title:", error);
      // Create a minimal fallback if everything fails
      this.title = new Title(this.gl, `Scene ${this.index + 1}`, "30px Arial", "#ffffff");
      this.title.scale.set(0.1, 0.1, 1);
      this.title.position.y = -0.5;
      this.title.setParent(this.plane);
    }
  }

  update(scroll: { current: number, last: number }, direction: string) {
    this.plane.position.x = this.x - scroll.current - this.extra;

    const x = this.plane.position.x;
    const H = this.viewport.width / 2;

    if (this.bend === 0) {
      this.plane.position.y = 0;
      this.plane.rotation.z = 0;
    } else {
      const B_abs = Math.abs(this.bend);
      const R = (H * H + B_abs * B_abs) / (2 * B_abs);
      const effectiveX = Math.min(Math.abs(x), H);

      const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
      if (this.bend > 0) {
        this.plane.position.y = -arc;
        this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R);
      } else {
        this.plane.position.y = arc;
        this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R);
      }
    }

    this.speed = scroll.current - scroll.last;
    this.program.uniforms.uTime.value += 0.04;
    this.program.uniforms.uSpeed.value = this.speed;

    const planeOffset = this.plane.scale.x / 2;
    const viewportOffset = this.viewport.width / 2;
    this.isBefore = this.plane.position.x + planeOffset < -viewportOffset;
    this.isAfter = this.plane.position.x - planeOffset > viewportOffset;
    if (direction === "right" && this.isBefore) {
      this.extra -= this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
    if (direction === "left" && this.isAfter) {
      this.extra += this.widthTotal;
      this.isBefore = this.isAfter = false;
    }
  }

  onResize({ screen, viewport }: { screen?: { width: number, height: number }, viewport?: { width: number, height: number } } = {}) {
    if (screen) this.screen = screen;
    if (viewport) {
      this.viewport = viewport;
      if (this.plane.program.uniforms.uViewportSizes) {
        this.plane.program.uniforms.uViewportSizes.value = [this.viewport.width, this.viewport.height];
      }
    }
    this.scale = this.screen.height / 1500;
    this.plane.scale.y = (this.viewport.height * (900 * this.scale)) / this.screen.height;
    this.plane.scale.x = (this.viewport.width * (700 * this.scale)) / this.screen.width;
    this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
    this.padding = 2;
    this.width = this.plane.scale.x + this.padding;
    this.widthTotal = this.width * this.length;
    this.x = this.width * this.index;
  }
}

class App {
  container: HTMLElement;
  scrollSpeed: number;
  scroll: { ease: number, current: number, target: number, last: number, position?: number };
  onCheckDebounce: () => void;
  renderer!: OGL_Renderer;
  gl: any;
  camera!: OGL_Camera;
  scene!: OGL_Transform;
  planeGeometry!: OGL_Plane;
  mediasImages!: { image: string, text: string }[];
  medias!: Media[];
  isDown: boolean = false;
  start: number = 0;
  screen!: { width: number, height: number };
  viewport!: { width: number, height: number };
  raf!: number;
  
  boundOnResize: () => void;
  boundOnWheel: (e: WheelEvent) => void;
  boundOnTouchDown: (e: MouseEvent | TouchEvent) => void;
  boundOnTouchMove: (e: MouseEvent | TouchEvent) => void;
  boundOnTouchUp: () => void;


  constructor(
    container: HTMLElement,
    {
      items,
      bend,
      textColor = "#ffffff",
      borderRadius = 0,
      font = "bold 30px Figtree",
      scrollSpeed = 2,
      scrollEase = 0.05,
    }: CircularGalleryProps
  ) {
    autoBind(this);
    this.container = container;
    this.scrollSpeed = scrollSpeed;
    this.scroll = { ease: scrollEase, current: 0, target: 0, last: 0 };
    this.onCheckDebounce = debounce(this.onCheck, 200);

    this.createRenderer();
    this.createCamera();
    this.createScene();
    this.onResize();
    this.createGeometry();
    this.createMedias(items, bend, textColor, borderRadius, font);
    this.update();
    
    this.boundOnResize = this.onResize.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnTouchDown = this.onTouchDown.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchUp = this.onTouchUp.bind(this);
    
    this.addEventListeners();
  }

  createRenderer() {
    this.renderer = new Renderer({ alpha: true });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
  }

  createCamera() {
    this.camera = new Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  }

  createScene() {
    this.scene = new Transform();
  }

  createGeometry() {
    this.planeGeometry = new Plane(this.gl, {
      heightSegments: 50,
      widthSegments: 100,
    });
  }

  createMedias(items?: { image: string, text: string }[], bend: number = 1, textColor?: string, borderRadius?: number, font?: string) {
    const defaultItems = [
      { image: `https://picsum.photos/seed/1/800/600?grayscale`, text: "Bridge" },
      { image: `https://picsum.photos/seed/2/800/600?grayscale`, text: "Desk Setup" },
      { image: `https://picsum.photos/seed/3/800/600?grayscale`, text: "Waterfall" },
    ];
    const galleryItems = items && items.length ? items : defaultItems;
    this.mediasImages = galleryItems.concat(galleryItems); // Duplicate for seamless loop
    this.medias = this.mediasImages.map((data, index) => {
      return new Media({
        geometry: this.planeGeometry,
        gl: this.gl,
        image: data.image,
        index,
        length: this.mediasImages.length,
        renderer: this.renderer,
        scene: this.scene,
        screen: this.screen,
        text: data.text,
        viewport: this.viewport,
        bend,
        textColor: textColor || "#ffffff",
        borderRadius: borderRadius || 0,
        font: font || "bold 30px Figtree",
      });
    });
  }
  
  onTouchDown(e: MouseEvent | TouchEvent) {
    this.isDown = true;
    this.scroll.position = this.scroll.current;
    this.start = 'touches' in e ? e.touches[0].clientX : e.clientX;
  }
  
  onTouchMove(e: MouseEvent | TouchEvent) {
    if (!this.isDown) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const distance = (this.start - x) * (this.scrollSpeed * 0.025);
    this.scroll.target = this.scroll.position! + distance;
  }

  onTouchUp() {
    this.isDown = false;
    this.onCheck();
  }

  onWheel(e: WheelEvent) {
    const delta = e.deltaY || (e as any).wheelDelta || e.detail;
    this.scroll.target += (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2;
    this.onCheckDebounce();
  }

  onCheck() {
    if (!this.medias || !this.medias[0]) return;
    const width = this.medias[0].width;
    const itemIndex = Math.round(Math.abs(this.scroll.target) / width);
    const item = width * itemIndex;
    this.scroll.target = this.scroll.target < 0 ? -item : item;
  }

  onResize() {
    this.screen = {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({
      aspect: this.screen.width / this.screen.height,
    });
    const fov = (this.camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    this.viewport = { width, height };
    if (this.medias) {
      this.medias.forEach((media) => media.onResize({ screen: this.screen, viewport: this.viewport }));
    }
  }

  update() {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    const direction = this.scroll.current > this.scroll.last ? "right" : "left";
    if (this.medias) {
      this.medias.forEach((media) => media.update(this.scroll, direction));
    }
    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.raf = window.requestAnimationFrame(this.update.bind(this));
  }

  addEventListeners() {
    this.boundOnResize = this.onResize.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnTouchDown = this.onTouchDown.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchUp = this.onTouchUp.bind(this);
    window.addEventListener("resize", this.boundOnResize);
    window.addEventListener("wheel", this.boundOnWheel, { passive: false });
    window.addEventListener("mousedown", this.boundOnTouchDown);
    window.addEventListener("mousemove", this.boundOnTouchMove);
    window.addEventListener("mouseup", this.boundOnTouchUp);
    window.addEventListener("touchstart", this.boundOnTouchDown);
    window.addEventListener("touchmove", this.boundOnTouchMove);
    window.addEventListener("touchend", this.boundOnTouchUp);
  }

  destroy() {
    window.cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.boundOnResize);
    window.removeEventListener("wheel", this.boundOnWheel);
    window.removeEventListener("mousedown", this.boundOnTouchDown);
    window.removeEventListener("mousemove", this.boundOnTouchMove);
    window.removeEventListener("mouseup", this.boundOnTouchUp);
    window.removeEventListener("touchstart", this.boundOnTouchDown);
    window.removeEventListener("touchmove", this.boundOnTouchMove);
    window.removeEventListener("touchend", this.boundOnTouchUp);

    try {
        if (this.gl.canvas && this.gl.canvas.parentNode) {
            this.gl.canvas.parentNode.removeChild(this.gl.canvas);
        }
    } catch (e) {
        console.error("Error cleaning up WebGL canvas:", e);
    }
  }
}

// --- React Component ---

export interface CircularGalleryProps {
  items?: { image: string, text: string }[];
  bend?: number;
  textColor?: string;
  borderRadius?: number;
  font?: string;
  scrollSpeed?: number;
  scrollEase?: number;
}

export default function CircularGallery({
  items,
  bend = 3,
  textColor = "#ffffff",
  borderRadius = 0.05,
  font = "bold 30px Figtree",
  scrollSpeed = 2,
  scrollEase = 0.05,
}: CircularGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const app = new App(containerRef.current, { items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase });
    
    return () => {
      app.destroy();
    };
  }, [items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase]);

  return <div ref={containerRef} className="w-full h-full" />;
} 