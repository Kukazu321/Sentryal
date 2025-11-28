
import { granuleSearchService } from '../src/services/granuleSearchService';
import logger from '../src/utils/logger';

// Coordonnées de test (Ton infrastructure ou une zone par défaut)
// BBox format: [[lon, lat], [lon, lat], ...] (GeoJSON Polygon ring)
const TEST_BBOX = {
    type: 'Polygon',
    coordinates: [[
        [2.3, 48.8], [2.4, 48.8], [2.4, 48.9], [2.3, 48.9], [2.3, 48.8] // Paris approx
    ]]
};

// Date cible (ce que tu as essayé de mettre)
const TARGET_DATE = '2024-10-28';

async function runCheck() {
    console.log('🔍 DIAGNOSTIC DES DATES SENTINEL-1');
    console.log('===================================');
    console.log(`📅 Date cible : ${TARGET_DATE}`);
    console.log(`📍 Zone : Paris (Test)`);

    try {
        // 1. Chercher TOUTES les images à +/- 12 jours
        console.log('\n1. Recherche des images brutes...');
        const granules = await granuleSearchService.findClosestGranules(
            TEST_BBOX as any,
            TARGET_DATE,
            20, // On en demande beaucoup pour voir les tracks
            { searchWindowDays: 12 }
        );

        console.log(`\n📊 RÉSULTATS (${granules.length} images trouvées) :`);
        console.log('----------------------------------------------------------------');
        console.log('| Date       | Track | Direction  | Nom (Fin)                    |');
        console.log('----------------------------------------------------------------');

        const tracks = new Map();

        granules.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        granules.forEach(g => {
            const date = g.startTime.split('T')[0];
            const track = g.pathNumber;
            const dir = g.flightDirection.substring(0, 3);
            const nameShort = g.granuleName.slice(-25);

            console.log(`| ${date} | ${track.toString().padEnd(5)} | ${dir.padEnd(10)} | ...${nameShort} |`);

            // Compter les images par track
            if (!tracks.has(track)) tracks.set(track, 0);
            tracks.set(track, tracks.get(track) + 1);
        });

        console.log('----------------------------------------------------------------');

        // 2. Analyse des Tracks
        console.log('\n🧠 ANALYSE DE COMPATIBILITÉ :');
        let bestTrack = -1;
        let maxCount = 0;

        tracks.forEach((count, track) => {
            console.log(`- Track ${track} : ${count} images disponibles`);
            if (count > maxCount) {
                maxCount = count;
                bestTrack = track;
            }
        });

        if (maxCount < 2) {
            console.log('\n❌ ERREUR CRITIQUE : Aucune paire possible !');
            console.log('Le satellite passe, mais jamais sur le même rail deux fois de suite dans cette période.');
        } else {
            console.log(`\n✅ MEILLEUR CHOIX : Track ${bestTrack}`);
            console.log('Pour que ça marche, il faut FORCER le système à n\'utiliser QUE ce track.');

            const validImages = granules.filter(g => g.pathNumber === bestTrack);
            console.log('Images utilisables pour l\'InSAR :');
            validImages.forEach(g => console.log(` -> ${g.startTime.split('T')[0]}`));
        }

    } catch (error) {
        console.error('Erreur:', error);
    }
}

runCheck();
