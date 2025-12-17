"""
Seed script to populate the database with initial violin practice rotation data
"""
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.instrument import Instrument
from app.models.practice_template import PracticeTemplate, PracticeDay, ExerciseBlock, Exercise

# Violin rotation data extracted from HTML prototype
ROTATION_DATA = {
    1: {
        "title": "Day 1: Detaché/Tone + String Crossings",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 1 → Simple 1st-3rd shifts",
        "scales": "Open string group (G, D, A major; E minor) - 3 octaves with separate bows and slurred patterns",
        "blockA": [
            "Kreutzer #2 - Sustained detaché, bow distribution",
            "Sevcik Op. 3, Variations 1-3 - Whole bow exercises",
            "Kreutzer #4 - String crossing with full bow"
        ],
        "blockB": [
            "Sevcik Op. 8 - Adjacent string crossing exercises",
            "Dont Op. 37 #2 - String crossing etude"
        ],
        "repertoire": "Bruch: Slow practice of opening (mm. 1-30), focus on tone quality and bow distribution"
    },
    2: {
        "title": "Day 2: Shifting (Positions 3-5) + Intonation",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 2 → Simple 1st-3rd shifts",
        "scales": "Open string group - Focus on arpeggios and different bowings",
        "blockA": [
            "Whistler Introducing Positions Book 2 - 3rd-5th position exercises",
            "Kreutzer #8 - 3rd position work",
            "Sevcik Op. 8 - Shifting exercises (1st, 3rd, 5th positions)"
        ],
        "blockB": [
            "Scales Plus! - Current scale with position shifts",
            "Trott Melodious Double Stops #1-3 - Slow, for intonation"
        ],
        "repertoire": "Bach D minor: Isolate and drill all shifts in the Allemande"
    },
    3: {
        "title": "Day 3: Martelé/Articulation + Bow Strokes",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 3 → Simple 1st-3rd shifts",
        "scales": "First finger group (C, F major; D, G minor) - 3 octaves",
        "blockA": [
            "Kreutzer #1 - Martelé articulation",
            "Mazas Op. 36 Book 1, #3 - Brilliant study with martelé",
            "Sevcik Op. 3 - Variations with stopped bow strokes"
        ],
        "blockB": [
            "Schradieck Book 1, Ex. 4-6 - Clean articulation",
            "Dont Op. 37 #4 - Staccato/articulation study"
        ],
        "repertoire": "Bruch: Articulated passages (running sixteenths), focus on clarity"
    },
    4: {
        "title": "Day 4: Double Stops (Thirds/Sixths) + Left Hand",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 1 → Simple 1st-3rd shifts",
        "scales": "First finger group - Arpeggios and different patterns",
        "blockA": [
            "Polo Double Stops - Thirds exercises (easier keys)",
            "Trott Melodious Double Stops #7-10 - Thirds",
            "Sevcik Op. 8 - Double-stop preparatory exercises"
        ],
        "blockB": [
            "Whistler Developing Double Stops - Thirds exercises",
            "Mazas Op. 36 Book 2, #4 - Thirds study"
        ],
        "repertoire": "Bach D minor: Chaconne double-stop variations or chord practice"
    },
    5: {
        "title": "Day 5: Spiccato/Off-String + Agility",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 2 → Simple 1st-3rd shifts",
        "scales": "Second finger group (Bb, Eb major; C, F minor) - 3 octaves",
        "blockA": [
            "Kreutzer #5 - Spiccato development",
            "Mazas Op. 36 Book 1, #10 - Spiccato etude",
            "Sevcik Op. 3 - Variations with spiccato bowing"
        ],
        "blockB": [
            "Dont Op. 37 #8 - Velocity study with light bow",
            "Schradieck with spiccato bowing pattern"
        ],
        "repertoire": "Bruch: Passages requiring spiccato or light bowing texture"
    },
    6: {
        "title": "Day 6: Shifting (Higher Positions) + Patterns",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 3 → Simple 1st-5th shifts",
        "scales": "Second finger group - Arpeggios and chromatic patterns",
        "blockA": [
            "Kreutzer #13 - Position work through 7th position",
            "Rode #4 or #7 - Higher position études",
            "Sevcik Op. 8 - Chromatic shifting exercises"
        ],
        "blockB": [
            "Whistler Introducing Positions - 5th-7th position exercises",
            "Scales Plus! - Chromatic scales and patterns"
        ],
        "repertoire": "Bruch or Bach: Identify highest position passages, isolate and drill"
    },
    7: {
        "title": "Day 7: Double Stops (Octaves/Mixed) + Coordination",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 1 → Simple 1st-3rd shifts",
        "scales": "Third finger group (B, E major; C#, F# minor) - 3 octaves",
        "blockA": [
            "Polo Double Stops - Octave exercises",
            "Trott Melodious Double Stops #18-20 - Octaves",
            "Sevcik Op. 8 - Octave preparation"
        ],
        "blockB": [
            "Whistler Developing Double Stops - Octave section",
            "Kreutzer #32 or #33 - Octave studies"
        ],
        "repertoire": "Bach D minor: Double-stop passages, both notes speaking clearly"
    },
    8: {
        "title": "Day 8: Detaché/Tone + String Crossings (Week 2)",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 2 → Simple 1st-3rd shifts",
        "scales": "Open string group - Review with focus on tone quality",
        "blockA": [
            "Dont Op. 37 #1 - Sustained bow control",
            "Kreutzer #9 - String crossings with smooth connections",
            "Rode #1 - Long bow strokes"
        ],
        "blockB": [
            "Sevcik Op. 3 - Different variations than Day 1",
            "Mazas Op. 36 Book 1, #1 - String crossing with melody"
        ],
        "repertoire": "Bruch: Main theme (after intro), singing tone and legato"
    },
    9: {
        "title": "Day 9: Shifting + Intonation (Week 2)",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 3 → Simple 1st-5th shifts",
        "scales": "First finger group - Review with attention to intonation",
        "blockA": [
            "Kreutzer #10 - Shifting study",
            "Mazas Op. 36 Book 2, #1 - Scale study with shifts",
            "Rode #8 - Position work"
        ],
        "blockB": [
            "Sevcik Op. 8 - Different shifting patterns",
            "Current scale in all positions on one string"
        ],
        "repertoire": "Bruch: Development section, map out position changes"
    },
    10: {
        "title": "Day 10: Martelé/Articulation (Week 2)",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 1 → Simple 1st-3rd shifts",
        "scales": "Second finger group - Review with varied articulations",
        "blockA": [
            "Kreutzer #7 - Varied bow strokes",
            "Dont Op. 37 #9 - Mixed articulation",
            "Mazas Op. 36 Book 1, #5 - Staccato"
        ],
        "blockB": [
            "Sevcik Op. 3 - Different stroke variations",
            "Rode #2 - Detaché and martelé mixed"
        ],
        "repertoire": "Bach D minor: Courante or Gigue, rhythmic clarity"
    },
    11: {
        "title": "Day 11: Double Stops + Left Hand (Week 2)",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 2 → Simple 1st-3rd shifts",
        "scales": "Third finger group - Review with double-stop focus",
        "blockA": [
            "Polo Double Stops - Sixths exercises",
            "Trott Melodious Double Stops #11-14 - Sixths",
            "Kreutzer #35 or #36 - Sixths studies"
        ],
        "blockB": [
            "Whistler Developing Double Stops - Sixths section",
            "Mazas Op. 36 Book 2, #5 - Sixths"
        ],
        "repertoire": "Bach D minor: Double-stop sections, slow with tuner"
    },
    12: {
        "title": "Day 12: Spiccato/Off-String (Week 2)",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 3 → Simple 1st-3rd shifts",
        "scales": "Open string group - With spiccato bowing",
        "blockA": [
            "Dont Op. 37 #5 - Velocity with off-string bowing",
            "Rode #10 - Spiccato étude",
            "Mazas Op. 36 Book 1, #15 - Agility study"
        ],
        "blockB": [
            "Kreutzer #11 - Tempo building with light bow",
            "Scales Plus! with spiccato bowing"
        ],
        "repertoire": "Bruch: Fast passage work, building speed gradually"
    },
    13: {
        "title": "Day 13: Shifting (Higher/Chromatic) Week 2",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 1 → Simple 1st-7th shifts",
        "scales": "First finger group - Chromatic variations",
        "blockA": [
            "Kreutzer #14 or #15 - Extended position work",
            "Dont Op. 37 #12 - Chromatic study",
            "Rode #9 - Higher positions"
        ],
        "blockB": [
            "Sevcik Op. 8 - Different chromatic/position patterns",
            "Mazas Op. 36 Book 2, #9 - Chromatic study"
        ],
        "repertoire": "Highest/most chromatic passages, drill slowly"
    },
    14: {
        "title": "Day 14: Double Stops (Mixed) Week 2",
        "warmup": "Open strings → Finger tapping → Schradieck Ex. 2 → Simple 1st-3rd shifts",
        "scales": "Second finger group - With double-stop patterns",
        "blockA": [
            "Kreutzer #34 - Mixed intervals",
            "Dont Op. 37 #17 - Double-stop étude",
            "Trott - Selection of mixed interval studies"
        ],
        "blockB": [
            "Polo Double Stops - Mixed interval exercises",
            "Sevcik Op. 8 - Double-stop coordination"
        ],
        "repertoire": "Run through all double-stops in current repertoire"
    }
}


def seed_database():
    """Populate database with violin practice rotation data"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    try:
        # Check if data already exists
        existing_instrument = db.query(Instrument).filter(Instrument.name == "Violin").first()
        if existing_instrument:
            print("Database already seeded. Skipping...")
            return
        
        print("Creating Violin instrument...")
        violin = Instrument(
            name="Violin",
            description="String instrument typically played with a bow"
        )
        db.add(violin)
        db.flush()  # Get the ID
        
        print("Creating 14-day practice template...")
        template = PracticeTemplate(
            instrument_id=violin.id,
            name="Intermediate Violin - 14-Day Rotation",
            days_count=14,
            description="A comprehensive 14-day rotation covering tone, shifting, articulation, double stops, and bow techniques",
            is_active=True
        )
        db.add(template)
        db.flush()
        
        print("Populating practice days and exercises...")
        for day_num in range(1, 15):
            day_data = ROTATION_DATA[day_num]
            
            # Create practice day
            practice_day = PracticeDay(
                template_id=template.id,
                day_number=day_num,
                title=day_data["title"],
                warmup=day_data["warmup"],
                scales=day_data["scales"],
                repertoire=day_data["repertoire"]
            )
            db.add(practice_day)
            db.flush()
            
            # Create exercise block A
            block_a = ExerciseBlock(
                practice_day_id=practice_day.id,
                block_type="blockA",
                display_order=1
            )
            db.add(block_a)
            db.flush()
            
            # Add exercises to block A
            for idx, exercise_text in enumerate(day_data["blockA"], start=1):
                exercise = Exercise(
                    block_id=block_a.id,
                    exercise_text=exercise_text,
                    display_order=idx
                )
                db.add(exercise)
            
            # Create exercise block B
            block_b = ExerciseBlock(
                practice_day_id=practice_day.id,
                block_type="blockB",
                display_order=2
            )
            db.add(block_b)
            db.flush()
            
            # Add exercises to block B
            for idx, exercise_text in enumerate(day_data["blockB"], start=1):
                exercise = Exercise(
                    block_id=block_b.id,
                    exercise_text=exercise_text,
                    display_order=idx
                )
                db.add(exercise)
            
            print(f"  Added Day {day_num}: {day_data['title']}")
        
        db.commit()
        print("\n✅ Database seeded successfully!")
        print(f"   - Created instrument: Violin")
        print(f"   - Created template: 14-day rotation")
        print(f"   - Created 14 practice days with exercises")
        
    except Exception as e:
        print(f"\n❌ Error seeding database: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()


