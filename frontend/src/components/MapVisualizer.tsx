import React, { useRef, useEffect, useState, useMemo } from 'react';
import { translateCoordinates, MAP_COORDINATES } from '../utils/maps';

interface MapPoint {
    x: number;
    y: number;
    z?: number; // Added Z coordinate
    type: 'smoke' | 'flash' | 'he' | 'fire' | 'kill' | 'death' | 'bomb' | 'decoy';
    color?: string;
    label?: string;
}

interface MapVisualizerProps {
    mapName: string;
    points: MapPoint[];
    mode: 'scatter' | 'heatmap';
}

export const MapVisualizer: React.FC<MapVisualizerProps> = ({ mapName, points, mode }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imgLoaded, setImgLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [selectedLayer, setSelectedLayer] = useState<string | null>(null);

    // Get Map Config
    const normalizedMapName = mapName.toLowerCase();
    const config = MAP_COORDINATES[normalizedMapName];

    // Determine layers
    const layers = useMemo(() => config?.layers ? Object.keys(config.layers) : [], [config]);

    // Set default layer on map change - ADJUSTING STATE DURING RENDER
    if (layers.length > 0) {
        if (!selectedLayer || !layers.includes(selectedLayer)) {
            setSelectedLayer(layers[0]);
        }
    } else if (selectedLayer !== null) {
        setSelectedLayer(null);
    }

    // Load Image
    useEffect(() => {
        const img = new Image();

        let src = config?.imageUrl || `/maps/${normalizedMapName}.jpg`;

        // If layer selected, use layer image
        if (selectedLayer && config?.layers && config.layers[selectedLayer]) {
            src = config.layers[selectedLayer].imageUrl;
        }

        // Prevent CORS issues with crossOrigin
        img.crossOrigin = "Anonymous";
        img.src = src;

        img.onload = () => {
            imgRef.current = img;
            setImgLoaded(true);
        };
        img.onerror = () => {
            // Fallback to placeholder if external fails
            if (src.startsWith('http')) {
                console.warn(`Failed to load map image from ${src}, trying local fallback.`);
                img.src = `/maps/${mapName}.jpg`;
            } else {
                console.error(`Failed to load map image: ${mapName}`);
                setImgLoaded(false);
            }
        };
    }, [mapName, selectedLayer, config?.imageUrl, config?.layers, normalizedMapName]); // Reload when layer changes

    // Draw
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imgLoaded || !imgRef.current) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Resize canvas to match image aspect ratio if needed, or fixed size
        const width = 800;
        const height = 800; // specific to square radar images usually, or adjust based on image natural dimensions
        canvas.width = width;
        canvas.height = height; // For now assuming square standard radars

        // Draw Map
        ctx.globalAlpha = 1;
        ctx.drawImage(imgRef.current, 0, 0, width, height);

        // Filter Points by Z-Range only if layer is selected AND range exists
        let pointsToDraw = points;
        if (selectedLayer && config?.layers && config.layers[selectedLayer]?.zRange) {
            const [minZ, maxZ] = config.layers[selectedLayer].zRange!;
            pointsToDraw = points.filter(p => {
                // If point has no Z, assume it belongs (or filter out? Defaulting to include for now)
                if (p.z === undefined) return true;
                return p.z >= minZ && p.z <= maxZ;
            });
        }

        if (mode === 'scatter') {
            // Scatter Render (Classic) - Now with Glow ("Heat Circles")
            pointsToDraw.forEach(p => {
                const { x, y } = translateCoordinates(normalizedMapName, p.x, p.y, width, height);

                const radius = 8; // Reduced glow radius as requested

                // Glowing Heat Circle
                const grad = ctx.createRadialGradient(x, y, 2, x, y, radius);

                let baseColor = p.color || '#fff';
                // Adjust base colors for better glow
                if (!p.color) {
                    if (p.type === 'smoke') baseColor = '#a0a0a0';
                    if (p.type === 'flash') baseColor = '#fbbf24';
                    if (p.type === 'he') baseColor = '#ef4444';
                    if (p.type === 'fire') baseColor = '#f97316';
                    if (p.type === 'kill') baseColor = '#22c55e';
                    if (p.type === 'death') baseColor = '#ef4444';
                }

                grad.addColorStop(0, '#fff'); // Bright center core
                grad.addColorStop(0.3, baseColor); // Intense colored body
                grad.addColorStop(0.6, baseColor); // Maintain color longer
                grad.addColorStop(1, 'rgba(0,0,0,0)'); // Soft edge fade

                // Draw outer glow first (optional for extra bloom)
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.globalAlpha = 1.0;

                // Draw core
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fillStyle = '#fff';
                ctx.fill();
            });
        } else if (mode === 'heatmap') {
            // DENSITY HEATMAP

            // 1. Setup temporary canvas for intensity map
            const heatCanvas = document.createElement('canvas');
            heatCanvas.width = width;
            heatCanvas.height = height;
            const heatCtx = heatCanvas.getContext('2d');

            if (heatCtx) {
                // 2. Draw intensity spots (black with low alpha) on white/transparent background?
                // Actually, standard is: Black background, draw white/colored blurred circles with low alpha
                // Then map grayscale value to color.

                // Using direct pixel manipulation or just composite operations.
                // Simple approach:
                // Background transparent. Draw radial gradients with low alpha.

                pointsToDraw.forEach(p => {
                    const { x, y } = translateCoordinates(normalizedMapName, p.x, p.y, width, height);

                    const radius = 35; // Size of influence
                    const intensity = 0.15; // How much one point contributes (0-1)

                    const grad = heatCtx.createRadialGradient(x, y, 0, x, y, radius);
                    grad.addColorStop(0, `rgba(0,0,0, ${intensity})`); // Black with alpha
                    grad.addColorStop(1, 'rgba(0,0,0,0)');

                    heatCtx.fillStyle = grad;
                    heatCtx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
                });

                // 3. Colorize
                // Get image data from heatCanvas
                const heatImage = heatCtx.getImageData(0, 0, width, height);
                const heatData = heatImage.data;

                // Create a gradient map (256 colors) - Simple rainbow: Blue -> Green -> Yellow -> Red
                const gradientCanvas = document.createElement('canvas');
                gradientCanvas.width = 1;
                gradientCanvas.height = 256;
                const gradCtx = gradientCanvas.getContext('2d');
                if (gradCtx) {
                    const gradient = gradCtx.createLinearGradient(0, 0, 0, 256);
                    gradient.addColorStop(0.0, 'rgba(0, 0, 255, 0)'); // Threshold - completely transparent
                    gradient.addColorStop(0.2, 'rgba(0, 0, 255, 0.4)'); // Blue
                    gradient.addColorStop(0.4, 'rgba(0, 255, 255, 0.5)'); // Cyan
                    gradient.addColorStop(0.6, 'rgba(0, 255, 0, 0.6)'); // Green
                    gradient.addColorStop(0.8, 'rgba(255, 255, 0, 0.8)'); // Yellow
                    gradient.addColorStop(1.0, 'rgba(255, 0, 0, 0.9)'); // Red

                    gradCtx.fillStyle = gradient;
                    gradCtx.fillRect(0, 0, 1, 256);

                    const gradientColors = gradCtx.getImageData(0, 0, 1, 256).data;

                    // 4. Map intensity to color
                    for (let i = 0; i < heatData.length; i += 4) {
                        // Alpha channel of the black drawing (which is actually in the alpha channel if we drew with rgba(0,0,0, alpha))
                        // Wait, if we drew on transparent canvas with rgba(0,0,0, alpha), the RGB is 0,0,0 and A is accumulated.
                        const alpha = heatData[i + 3];

                        if (alpha > 0) {
                            // Map alpha (0-255) to gradient color
                            // Increase contrast/threshold
                            let offset = alpha * 3;
                            if (offset > 255) offset = 255;

                            const colorIndex = Math.floor(offset) * 4;

                            heatData[i] = gradientColors[colorIndex]; // R
                            heatData[i + 1] = gradientColors[colorIndex + 1]; // G
                            heatData[i + 2] = gradientColors[colorIndex + 2]; // B
                            heatData[i + 3] = gradientColors[colorIndex + 3]; // A
                        }
                    }

                    heatCtx.putImageData(heatImage, 0, 0);

                    // 5. Draw HeatMap overlay onto main canvas
                    ctx.drawImage(heatCanvas, 0, 0);
                }
            }
        }

    }, [imgLoaded, points, mapName, mode, selectedLayer, normalizedMapName, config?.layers]);

    if (!imgLoaded) {
        return <div style={{ width: '100%', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>Loading Map... (Ensure /public/maps/{mapName}.jpg exists)</div>;
    }

    return (
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', overflow: 'hidden', borderRadius: '12px', background: '#0f1014' }}>
            {/* Layer Controls */}
            {layers.length > 0 && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, display: 'flex', gap: '5px' }}>
                    {layers.map((layer: string) => (
                        <button
                            key={layer}
                            onClick={() => setSelectedLayer(layer)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: selectedLayer === layer ? '#3b82f6' : 'rgba(0,0,0,0.6)',
                                color: '#fff',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                fontSize: '12px'
                            }}
                        >
                            {layer}
                        </button>
                    ))}
                </div>
            )}
            <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto' }} />
        </div>
    );
};
