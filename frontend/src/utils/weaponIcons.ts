const BASE_PATH = '/5v5stat/weapons/equipment';

export const weaponIcons: Record<string, string> = {
    // Rifles
    'AK-47': `${BASE_PATH}/ak47.svg`,
    'M4A1-S': `${BASE_PATH}/m4a1_silencer.svg`,
    'M4A4': `${BASE_PATH}/m4a1.svg`,
    'AWP': `${BASE_PATH}/awp.svg`,
    'FAMAS': `${BASE_PATH}/famas.svg`,
    'GALIL AR': `${BASE_PATH}/galilar.svg`,
    'SSG 08': `${BASE_PATH}/ssg08.svg`,
    'SG 553': `${BASE_PATH}/sg556.svg`,
    'AUG': `${BASE_PATH}/aug.svg`,
    'SCAR-20': `${BASE_PATH}/scar20.svg`,
    'G3SG1': `${BASE_PATH}/g3sg1.svg`,

    // Pistols
    'USP-S': `${BASE_PATH}/usp_silencer.svg`,
    'GLOCK-18': `${BASE_PATH}/glock.svg`,
    'DESERT EAGLE': `${BASE_PATH}/deagle.svg`,
    'P250': `${BASE_PATH}/p250.svg`,
    'P2000': `${BASE_PATH}/p2000.svg`,
    'TEC-9': `${BASE_PATH}/tec9.svg`,
    'FIVE-SEVEN': `${BASE_PATH}/fiveseven.svg`,
    'CZ75-AUTO': `${BASE_PATH}/cz75a.svg`,
    'R8 REVOLVER': `${BASE_PATH}/revolver.svg`,
    'DUAL BERETTAS': `${BASE_PATH}/elite.svg`,

    // SMGs
    'MP9': `${BASE_PATH}/mp9.svg`,
    'MAC-10': `${BASE_PATH}/mac10.svg`,
    'UMP-45': `${BASE_PATH}/ump45.svg`,
    'MP7': `${BASE_PATH}/mp7.svg`,
    'MP5-SD': `${BASE_PATH}/mp5sd.svg`,
    'P90': `${BASE_PATH}/p90.svg`,
    'PP-BIZON': `${BASE_PATH}/bizon.svg`,

    // Heavy
    'NOVA': `${BASE_PATH}/nova.svg`,
    'XM1014': `${BASE_PATH}/xm1014.svg`,
    'MAG-7': `${BASE_PATH}/mag7.svg`,
    'SAWED-OFF': `${BASE_PATH}/sawedoff.svg`,
    'NEGEV': `${BASE_PATH}/negev.svg`,
    'M249': `${BASE_PATH}/m249.svg`,

    // Utility & Other
    'KNIFE': `${BASE_PATH}/knife.svg`,
    'ZEUS X27': `${BASE_PATH}/taser.svg`,
    'C4': `${BASE_PATH}/c4.svg`,
    'HE GRENADE': `${BASE_PATH}/hegrenade.svg`,
    'FLASHBANG': `${BASE_PATH}/flashbang.svg`,
    'SMOKE GRENADE': `${BASE_PATH}/smokegrenade.svg`,
    'MOLOTOV': `${BASE_PATH}/molotov.svg`,
    'INCENDIARY GRENADE': `${BASE_PATH}/incgrenade.svg`,
    'DECOY GRENADE': `${BASE_PATH}/decoy.svg`,
};

export const getWeaponIcon = (weaponName: string): string | undefined => {
    if (!weaponName) return undefined;

    // Normalize name: remove weapon_ prefix and to upper case
    const name = weaponName.replace('weapon_', '').toUpperCase().replace(/_/g, ' ');

    // Direct match
    if (weaponIcons[name]) return weaponIcons[name];

    // Common aliases and variations
    const upperName = name.toUpperCase();

    if (upperName === 'AK47') return weaponIcons['AK-47'];
    if (upperName === 'M4A1 SILENCER' || upperName === 'M4A1S' || upperName === 'M4A1 S') return weaponIcons['M4A1-S'];
    if (upperName === 'M4A1' || upperName === 'M4A4') return weaponIcons['M4A4'];
    if (upperName === 'USP SILENCER' || upperName === 'USPS' || upperName === 'USP S') return weaponIcons['USP-S'];
    if (upperName === 'GLOCK') return weaponIcons['GLOCK-18'];
    if (upperName === 'DEAGLE') return weaponIcons['DESERT EAGLE'];
    if (upperName === 'TASER' || upperName === 'ZEUS') return weaponIcons['ZEUS X27'];
    if (upperName === 'SG556' || upperName === 'SG553') return weaponIcons['SG 553'];
    if (upperName === 'FIVESEVEN' || upperName === 'FIVE SEVEN') return weaponIcons['FIVE-SEVEN'];
    if (upperName === 'TEC9') return weaponIcons['TEC-9'];
    if (upperName === 'UMP45') return weaponIcons['UMP-45'];
    if (upperName === 'BIZON') return weaponIcons['PP-BIZON'];

    // Knives
    if (upperName.includes('KNIFE') || upperName.includes('BAYONET')) return weaponIcons['KNIFE'];

    // Utility
    if (upperName.includes('HEGRENADE')) return weaponIcons['HE GRENADE'];
    if (upperName.includes('FLASHBANG')) return weaponIcons['FLASHBANG'];
    if (upperName.includes('SMOKEGRENADE')) return weaponIcons['SMOKE GRENADE'];
    if (upperName.includes('MOLOTOV')) return weaponIcons['MOLOTOV'];
    if (upperName.includes('INCGRENADE')) return weaponIcons['INCENDIARY GRENADE'];
    if (upperName.includes('DECOY')) return weaponIcons['DECOY GRENADE'];
    if (upperName === 'C4' || upperName === 'PLANTED C4') return weaponIcons['C4'];

    return undefined;
};
