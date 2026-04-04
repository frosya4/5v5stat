export interface MapCoordinate {
    x: number;
    y: number;
    scale: number;
    imageUrl: string;
    layers?: {
        [key: string]: {
            imageUrl: string;
            zRange?: [number, number]; // [min, max]
        }
    };
}

export const MAP_COORDINATES: Record<string, MapCoordinate> = {
    // de_mirage
    'de_mirage': { x: -3230, y: 1713, scale: 5.0, imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_mirage/map_style_cs2.png' },
    // de_inferno
    'de_inferno': { x: -2087, y: 3870, scale: 4.9, imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_inferno/map_style_cs2.png' },
    // de_overpass
    'de_overpass': { x: -4831, y: 1781, scale: 5.2, imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_overpass/map_style_cs2.png' },
    // de_nuke
    // de_nuke
    'de_nuke': {
        x: -3453, y: 2887, scale: 7.0,
        imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_nuke/map_style_cs2.png',
        layers: {
            'upper': { imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_nuke/map_style_cs2.png', zRange: [-400, 10000] },
            'lower': { imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_nuke/radar_1_lower.png', zRange: [-10000, -400] }
        }
    },
    // de_vertigo
    'de_vertigo': { x: -3168, y: 1762, scale: 4.0, imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_vertigo/map_style_cs2.png' },
    // de_ancient
    'de_ancient': { x: -2953, y: 2164, scale: 5.0, imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_ancient/map_style_cs2.png' },
    // de_anubis
    'de_anubis': { x: -2796, y: 3328, scale: 5.22, imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_anubis/map_style_cs2.png' },
    // de_dust2
    'de_dust2': { x: -2476, y: 3239, scale: 4.4, imageUrl: 'https://raw.githubusercontent.com/imwqqz/Valthrun/8c831dae55fb83c4064467101e143203f7e187ec/radar/web/src/map-info/de_dust2/map_style_cs2.png' }
};

export const translateCoordinates = (mapName: string, wX: number, wY: number, imgWidth: number, imgHeight: number) => {
    const config = MAP_COORDINATES[mapName] || { x: 0, y: 0, scale: 1 };

    // Formula: (World - Offset) / Scale
    // Note: CS coordinates: X is usually left/right, Y is up/down (or vice versa depending on map rotation)
    // Most standard radar overviews use:
    const normalizedX = (wX - config.x) / config.scale;
    const normalizedY = (config.y - wY) / config.scale;

    // Scale from standard 1024x1024 radar size to actual image size
    const x = normalizedX * (imgWidth / 1024);
    const y = normalizedY * (imgHeight / 1024);

    return { x, y };
};
