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


# Starter library: instrument_category -> section_type -> list of (name, description, duration_minutes)
CURATED_BLOCKS = {
    # --- STRING INSTRUMENTS (shared across violin, viola, cello) ---
    "violin": {
        "warmup": [
            ("Open string warm-up", "Slow bows on each open string, focusing on tone and bow distribution", 3),
            ("Finger pattern exercises", "Basic finger patterns in first position across all strings", 3),
            ("Slow scales in first position", "One-octave scales at a comfortable tempo to warm up intonation", 5),
        ],
        "scales": [
            ("3-octave major scales", "All 12 major scales, ascending and descending", 10),
            ("3-octave minor scales", "Natural, harmonic, and melodic minor scales", 10),
            ("Arpeggios", "Major and minor arpeggios across 3 octaves", 5),
            ("Double stops: thirds", "Scales in thirds across two strings", 5),
            ("Double stops: sixths", "Scales in sixths across two strings", 5),
            ("Double stops: octaves", "Scales in octaves across two strings", 5),
            ("Chromatic scales", "Chromatic scale across full range", 3),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo", 10),
            ("Run-through of exposition", "Play through the exposition without stopping", 10),
            ("Full movement run-through", "Complete movement from memory or with score", 15),
            ("Intonation check with drone", "Play passages against a sustained drone pitch", 5),
            ("Musical phrasing work", "Focus on dynamics, rubato, and musical expression", 10),
        ],
        "sight_reading": [
            ("Sight-read a new etude", "Pick an unfamiliar etude and read through without stopping", 10),
            ("Orchestral excerpt reading", "Read through unfamiliar orchestral parts", 10),
        ],
        "cooldown": [
            ("Slow open strings", "Wind down with long, sustained open string tones", 2),
            ("Gentle vibrato exercises", "Relaxed vibrato on comfortable notes", 3),
        ],
    },
    "viola": {
        "warmup": [
            ("Open string warm-up", "Slow bows on each open string, focusing on tone and bow distribution", 3),
            ("Finger pattern exercises", "Basic finger patterns in first position across all strings", 3),
            ("Slow scales in first position", "One-octave scales at a comfortable tempo to warm up intonation", 5),
        ],
        "scales": [
            ("3-octave major scales", "All 12 major scales, ascending and descending", 10),
            ("3-octave minor scales", "Natural, harmonic, and melodic minor scales", 10),
            ("Arpeggios", "Major and minor arpeggios across 3 octaves", 5),
            ("Chromatic scales", "Chromatic scale across full range", 3),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo", 10),
            ("Full movement run-through", "Complete movement from memory or with score", 15),
            ("Musical phrasing work", "Focus on dynamics, rubato, and musical expression", 10),
        ],
        "sight_reading": [
            ("Sight-read a new etude", "Pick an unfamiliar etude and read through without stopping", 10),
        ],
        "cooldown": [
            ("Slow open strings", "Wind down with long, sustained open string tones", 3),
        ],
    },
    "cello": {
        "warmup": [
            ("Open string warm-up", "Slow bows on each open string, focusing on tone and bow control", 3),
            ("Left hand stretches", "Gentle finger extensions and shifts in lower positions", 3),
            ("Slow scales in first position", "One-octave scales to center intonation", 5),
        ],
        "scales": [
            ("3-octave major scales", "All 12 major scales, ascending and descending", 10),
            ("3-octave minor scales", "Natural, harmonic, and melodic minor scales", 10),
            ("Arpeggios", "Major and minor arpeggios across 3 octaves", 5),
            ("Thumb position scales", "Scales incorporating thumb position in upper register", 5),
            ("Chromatic scales", "Chromatic scale across full range", 3),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo", 10),
            ("Full movement run-through", "Complete movement from memory or with score", 15),
            ("Intonation check with drone", "Play passages against a sustained drone pitch", 5),
        ],
        "cooldown": [
            ("Slow open strings", "Wind down with long, sustained open string tones", 3),
        ],
    },
    # --- PIANO ---
    "piano": {
        "warmup": [
            ("Hanon exercises", "Selected Hanon finger independence exercises at moderate tempo", 5),
            ("5-finger patterns", "Major and minor 5-finger patterns in all keys", 3),
            ("Chord progressions", "I-IV-V-I progressions in several keys to warm up hand shapes", 3),
        ],
        "scales": [
            ("Major scales — all keys", "2-octave major scales, hands together", 10),
            ("Minor scales — all keys", "Natural, harmonic, and melodic minor, hands together", 10),
            ("Arpeggios — all keys", "Major and minor arpeggios, 2 octaves, hands together", 5),
            ("Chromatic scales", "Chromatic scale, hands together, full keyboard", 3),
            ("Scales in thirds", "Major scales played in parallel thirds", 5),
            ("Scales in sixths", "Major scales played in parallel sixths", 5),
        ],
        "repertoire": [
            ("Hands-separate practice", "Drill each hand independently on difficult passages", 10),
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo", 10),
            ("Full piece run-through", "Play through the entire piece without stopping", 15),
            ("Memorization work", "Practice from memory, checking against score", 10),
            ("Pedaling refinement", "Focus on pedal timing and changes", 5),
        ],
        "sight_reading": [
            ("Sight-read a new piece", "Pick an unfamiliar piece below your level and read through", 10),
            ("Lead sheet reading", "Read chord symbols and melody from a lead sheet", 10),
        ],
        "cooldown": [
            ("Free improvisation", "Unstructured playing to decompress", 5),
            ("Simple chord progressions", "Relaxed playing of familiar progressions", 3),
        ],
    },
    # --- GUITAR ---
    "guitar": {
        "warmup": [
            ("Chromatic finger exercise", "1-2-3-4 finger pattern across all strings", 3),
            ("Spider exercise", "Cross-string finger independence drill", 3),
            ("Open chord transitions", "Cycle through common open chords", 3),
        ],
        "scales": [
            ("Major scale patterns", "CAGED-based major scale patterns across the neck", 10),
            ("Minor pentatonic patterns", "All 5 pentatonic box patterns", 5),
            ("Major pentatonic patterns", "Pentatonic patterns in major keys", 5),
            ("Modes — selected positions", "Practice specific modes in context", 5),
            ("String skipping exercises", "Scale runs with string skips for accuracy", 5),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo", 10),
            ("Full song run-through", "Play through the entire piece without stopping", 10),
            ("Chord melody practice", "Work on arranging melody with chord voicings", 10),
            ("Improvisation over backing track", "Solo over a chord progression", 10),
        ],
        "sight_reading": [
            ("Sight-read a new piece", "Pick an unfamiliar piece and read through", 10),
        ],
        "ear_training": [
            ("Interval recognition", "Identify intervals by ear from a reference pitch", 5),
            ("Chord quality recognition", "Distinguish major, minor, diminished, augmented by ear", 5),
            ("Melody transcription", "Listen to a short melody and play it back", 10),
        ],
        "cooldown": [
            ("Free improvisation", "Unstructured playing to decompress", 5),
            ("Fingerpicking patterns", "Relaxed fingerpicking on familiar progressions", 3),
        ],
    },
    # --- FLUTE ---
    "flute": {
        "warmup": [
            ("Long tones", "Sustained notes across all registers, focusing on tone quality and breath support", 5),
            ("Harmonics", "Play harmonics from low register fingerings to develop embouchure flexibility", 3),
            ("Tone coloring exercises", "Explore different tone colors on the same pitch", 3),
        ],
        "scales": [
            ("Major scales — all keys", "Full-range major scales with varied articulations", 10),
            ("Minor scales — all keys", "Natural, harmonic, and melodic minor scales", 10),
            ("Arpeggios", "Major and minor arpeggios across full range", 5),
            ("Chromatic scales", "Chromatic scale, full range, varied articulations", 3),
            ("Taffanel & Gaubert exercises", "Selected daily exercises from the classic method", 10),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging measures at reduced tempo", 10),
            ("Full movement run-through", "Complete movement from memory or with score", 15),
            ("Articulation detail work", "Focus on tonguing, slurs, and mixed articulations", 5),
        ],
        "sight_reading": [
            ("Sight-read a new etude", "Pick an unfamiliar etude and read through without stopping", 10),
        ],
        "cooldown": [
            ("Long tones — pianissimo", "Quiet sustained tones to cool down embouchure", 3),
            ("Gentle melodic playing", "Play a familiar, comfortable melody to wind down", 3),
        ],
    },
    # --- VOICE ---
    "voice": {
        "warmup": [
            ("Lip trills", "Ascending and descending patterns on lip trills to engage breath support", 3),
            ("Humming exercises", "Gentle humming through the range to warm up resonance", 3),
            ("Vowel modification exercises", "Sing through vowels (ah-eh-ee-oh-oo) on scales", 3),
            ("Breathing exercises", "Diaphragmatic breathing and breath management drills", 3),
        ],
        "scales": [
            ("Major scales on vowels", "Sing scales on different vowels to build consistency", 5),
            ("Arpeggios", "Major and minor arpeggios to build range and agility", 5),
            ("Interval leaps", "Practice ascending and descending interval jumps", 5),
            ("Messa di voce", "Crescendo and decrescendo on sustained pitches", 5),
        ],
        "repertoire": [
            ("Slow practice — difficult passages", "Isolate and drill challenging phrases at reduced tempo", 10),
            ("Full song run-through", "Sing through the entire piece without stopping", 10),
            ("Text and diction work", "Focus on consonants, vowels, and text clarity", 5),
            ("Interpretation and expression", "Work on dynamics, phrasing, and emotional delivery", 10),
        ],
        "sight_reading": [
            ("Sight-sing a new melody", "Read through an unfamiliar melody at sight", 10),
        ],
        "ear_training": [
            ("Interval recognition", "Identify intervals by ear from a reference pitch", 5),
            ("Solfege exercises", "Sight-singing with movable-do solfege", 5),
        ],
        "cooldown": [
            ("Gentle humming", "Hum softly through a comfortable range to cool down", 3),
            ("Stretching and relaxation", "Jaw, neck, and shoulder stretches after singing", 2),
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
                for name, description, duration in blocks:
                    block = CuratedBlock(
                        instrument_category=instrument_category,
                        name=name,
                        description=description,
                        section_type=section_type,
                        default_duration_minutes=duration,
                    )
                    session.add(block)
                    count += 1

        await session.commit()
        print(f"Seeded {count} curated blocks across {len(CURATED_BLOCKS)} instrument categories.")


if __name__ == "__main__":
    asyncio.run(seed())
