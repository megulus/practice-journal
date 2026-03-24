"""
Seed the curated_blocks table with a starter set of common practice blocks
organized by instrument category and section type.

Usage:
    cd backend
    python -m scripts.seed_curated_blocks
"""
import asyncio
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import engine, async_session
from app.models.curated import CuratedBlock


# Starter library: instrument_category -> section_type -> list of (name, description)
CURATED_BLOCKS = {
    # --- STRING INSTRUMENTS (shared across violin, viola, cello) ---
    "violin": {
        "warmup": [
            ("Open string warm-up", "Slow bows on each open string, focusing on tone and bow distribution"),
            ("Finger pattern exercises", "Basic finger patterns in first position across all strings"),
            ("Slow scales in first position", "One-octave scales at a comfortable tempo to warm up intonation"),
        ],
        "scales": [
            ("3-octave major scales", "All 12 major scales, ascending and descending"),
            ("3-octave minor scales", "Natural, harmonic, and melodic minor scales"),
            ("Arpeggios", "Major and minor arpeggios across 3 octaves"),
            ("Double stops: thirds", "Scales in thirds across two strings"),
            ("Double stops: sixths", "Scales in sixths across two strings"),
            ("Double stops: octaves", "Scales in octaves across two strings"),
            ("Chromatic scales", "Chromatic scale across full range"),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo"),
            ("Run-through of exposition", "Play through the exposition without stopping"),
            ("Full movement run-through", "Complete movement from memory or with score"),
            ("Intonation check with drone", "Play passages against a sustained drone pitch"),
            ("Musical phrasing work", "Focus on dynamics, rubato, and musical expression"),
        ],
        "sight_reading": [
            ("Sight-read a new etude", "Pick an unfamiliar etude and read through without stopping"),
            ("Orchestral excerpt reading", "Read through unfamiliar orchestral parts"),
        ],
        "cooldown": [
            ("Slow open strings", "Wind down with long, sustained open string tones"),
            ("Gentle vibrato exercises", "Relaxed vibrato on comfortable notes"),
        ],
    },
    "viola": {
        "warmup": [
            ("Open string warm-up", "Slow bows on each open string, focusing on tone and bow distribution"),
            ("Finger pattern exercises", "Basic finger patterns in first position across all strings"),
            ("Slow scales in first position", "One-octave scales at a comfortable tempo to warm up intonation"),
        ],
        "scales": [
            ("3-octave major scales", "All 12 major scales, ascending and descending"),
            ("3-octave minor scales", "Natural, harmonic, and melodic minor scales"),
            ("Arpeggios", "Major and minor arpeggios across 3 octaves"),
            ("Chromatic scales", "Chromatic scale across full range"),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo"),
            ("Full movement run-through", "Complete movement from memory or with score"),
            ("Musical phrasing work", "Focus on dynamics, rubato, and musical expression"),
        ],
        "sight_reading": [
            ("Sight-read a new etude", "Pick an unfamiliar etude and read through without stopping"),
        ],
        "cooldown": [
            ("Slow open strings", "Wind down with long, sustained open string tones"),
        ],
    },
    "cello": {
        "warmup": [
            ("Open string warm-up", "Slow bows on each open string, focusing on tone and bow control"),
            ("Left hand stretches", "Gentle finger extensions and shifts in lower positions"),
            ("Slow scales in first position", "One-octave scales to center intonation"),
        ],
        "scales": [
            ("3-octave major scales", "All 12 major scales, ascending and descending"),
            ("3-octave minor scales", "Natural, harmonic, and melodic minor scales"),
            ("Arpeggios", "Major and minor arpeggios across 3 octaves"),
            ("Thumb position scales", "Scales incorporating thumb position in upper register"),
            ("Chromatic scales", "Chromatic scale across full range"),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo"),
            ("Full movement run-through", "Complete movement from memory or with score"),
            ("Intonation check with drone", "Play passages against a sustained drone pitch"),
        ],
        "cooldown": [
            ("Slow open strings", "Wind down with long, sustained open string tones"),
        ],
    },
    # --- PIANO ---
    "piano": {
        "warmup": [
            ("Hanon exercises", "Selected Hanon finger independence exercises at moderate tempo"),
            ("5-finger patterns", "Major and minor 5-finger patterns in all keys"),
            ("Chord progressions", "I-IV-V-I progressions in several keys to warm up hand shapes"),
        ],
        "scales": [
            ("Major scales — all keys", "2-octave major scales, hands together"),
            ("Minor scales — all keys", "Natural, harmonic, and melodic minor, hands together"),
            ("Arpeggios — all keys", "Major and minor arpeggios, 2 octaves, hands together"),
            ("Chromatic scales", "Chromatic scale, hands together, full keyboard"),
            ("Scales in thirds", "Major scales played in parallel thirds"),
            ("Scales in sixths", "Major scales played in parallel sixths"),
        ],
        "repertoire": [
            ("Hands-separate practice", "Drill each hand independently on difficult passages"),
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo"),
            ("Full piece run-through", "Play through the entire piece without stopping"),
            ("Memorization work", "Practice from memory, checking against score"),
            ("Pedaling refinement", "Focus on pedal timing and changes"),
        ],
        "sight_reading": [
            ("Sight-read a new piece", "Pick an unfamiliar piece below your level and read through"),
            ("Lead sheet reading", "Read chord symbols and melody from a lead sheet"),
        ],
        "cooldown": [
            ("Free improvisation", "Unstructured playing to decompress"),
            ("Simple chord progressions", "Relaxed playing of familiar progressions"),
        ],
    },
    # --- GUITAR ---
    "guitar": {
        "warmup": [
            ("Chromatic finger exercise", "1-2-3-4 finger pattern across all strings"),
            ("Spider exercise", "Cross-string finger independence drill"),
            ("Open chord transitions", "Cycle through common open chords"),
        ],
        "scales": [
            ("Major scale patterns", "CAGED-based major scale patterns across the neck"),
            ("Minor pentatonic patterns", "All 5 pentatonic box patterns"),
            ("Major pentatonic patterns", "Pentatonic patterns in major keys"),
            ("Modes — selected positions", "Practice specific modes in context"),
            ("String skipping exercises", "Scale runs with string skips for accuracy"),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo"),
            ("Full song run-through", "Play through the entire piece without stopping"),
            ("Chord melody practice", "Work on arranging melody with chord voicings"),
            ("Improvisation over backing track", "Solo over a chord progression"),
        ],
        "sight_reading": [
            ("Sight-read a new piece", "Pick an unfamiliar piece and read through"),
        ],
        "ear_training": [
            ("Interval recognition", "Identify intervals by ear from a reference pitch"),
            ("Chord quality recognition", "Distinguish major, minor, diminished, augmented by ear"),
            ("Melody transcription", "Listen to a short melody and play it back"),
        ],
        "cooldown": [
            ("Free improvisation", "Unstructured playing to decompress"),
            ("Fingerpicking patterns", "Relaxed fingerpicking on familiar progressions"),
        ],
    },
    # --- FLUTE ---
    "flute": {
        "warmup": [
            ("Long tones", "Sustained notes across all registers, focusing on tone quality and breath support"),
            ("Harmonics", "Play harmonics from low register fingerings to develop embouchure flexibility"),
            ("Tone coloring exercises", "Explore different tone colors on the same pitch"),
        ],
        "scales": [
            ("Major scales — all keys", "Full-range major scales with varied articulations"),
            ("Minor scales — all keys", "Natural, harmonic, and melodic minor scales"),
            ("Arpeggios", "Major and minor arpeggios across full range"),
            ("Chromatic scales", "Chromatic scale, full range, varied articulations"),
            ("Taffanel & Gaubert exercises", "Selected daily exercises from the classic method"),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo"),
            ("Full movement run-through", "Complete movement from memory or with score"),
            ("Articulation detail work", "Focus on tonguing, slurs, and mixed articulations"),
        ],
        "sight_reading": [
            ("Sight-read a new etude", "Pick an unfamiliar etude and read through without stopping"),
        ],
        "cooldown": [
            ("Long tones — pianissimo", "Quiet sustained tones to cool down embouchure"),
            ("Gentle melodic playing", "Play a familiar, comfortable melody to wind down"),
        ],
    },
    # --- VOICE ---
    "voice": {
        "warmup": [
            ("Lip trills", "Ascending and descending patterns on lip trills to engage breath support"),
            ("Humming exercises", "Gentle humming through the range to warm up resonance"),
            ("Vowel modification exercises", "Sing through vowels (ah-eh-ee-oh-oo) on scales"),
            ("Breathing exercises", "Diaphragmatic breathing and breath management drills"),
        ],
        "scales": [
            ("Major scales on vowels", "Sing scales on different vowels to build consistency"),
            ("Arpeggios", "Major and minor arpeggios to build range and agility"),
            ("Interval leaps", "Practice ascending and descending interval jumps"),
            ("Messa di voce", "Crescendo and decrescendo on sustained pitches"),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging phrases at reduced tempo"),
            ("Full song run-through", "Sing through the entire piece without stopping"),
            ("Text and diction work", "Focus on consonants, vowels, and text clarity"),
            ("Interpretation and expression", "Work on dynamics, phrasing, and emotional delivery"),
        ],
        "sight_reading": [
            ("Sight-sing a new melody", "Read through an unfamiliar melody at sight"),
        ],
        "ear_training": [
            ("Interval recognition", "Identify intervals by ear from a reference pitch"),
            ("Solfege exercises", "Sight-singing with movable-do solfege"),
        ],
        "cooldown": [
            ("Gentle humming", "Hum softly through a comfortable range to cool down"),
            ("Stretching and relaxation", "Jaw, neck, and shoulder stretches after singing"),
        ],
    },
}


async def seed():
    """Insert curated blocks, skipping any that already exist."""
    async with async_session() as session:
        # Check if we already have data
        result = await session.exec(select(CuratedBlock).limit(1))
        if result.first():
            print("Curated blocks already seeded — skipping.")
            return

        count = 0
        for instrument_category, sections in CURATED_BLOCKS.items():
            for section_type, blocks in sections.items():
                for name, description in blocks:
                    block = CuratedBlock(
                        instrument_category=instrument_category,
                        name=name,
                        description=description,
                        section_type=section_type,
                    )
                    session.add(block)
                    count += 1

        await session.commit()
        print(f"Seeded {count} curated blocks across {len(CURATED_BLOCKS)} instrument categories.")


if __name__ == "__main__":
    asyncio.run(seed())
