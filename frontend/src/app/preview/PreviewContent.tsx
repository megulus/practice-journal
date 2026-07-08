'use client'

import { useState, type ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'
import {
  Button,
  Pill,
  Checkbox,
  TextInput,
  TextArea,
  Card,
  SectionPip,
  ProgressBar,
  RotationBar,
  RotationDots,
  StatCard,
  VoiceInput,
} from '@/components/ui'
import {
  SECTION_COLORS_BY_NAME,
  type SectionColorName,
} from '@/lib/section-colors'

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mb-2xl">
      <h2
        className="text-text-primary font-semibold mb-md"
        style={{ fontSize: 15, letterSpacing: '-0.2px' }}
      >
        {title}
      </h2>
      <div className="space-y-md">{children}</div>
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-md">{children}</div>
}

function Showcase() {
  const [checked1, setChecked1] = useState(false)
  const [checked2, setChecked2] = useState(true)
  const [text, setText] = useState('')
  const [area, setArea] = useState('')
  const [voiceText, setVoiceText] = useState('')

  const sectionColorNames: SectionColorName[] = [
    'warmup',
    'cooldown',
    'blue',
    'purple',
    'amber',
    'pink',
    'indigo',
    'copper',
    'slate_blue',
    'olive',
  ]

  return (
    <div className="space-y-2xl">
      <Section title="Button — variants × sizes">
        <Row>
          <Button variant="primary" size="md">
            Primary md
          </Button>
          <Button variant="primary" size="sm">
            Primary sm
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </Row>
        <Row>
          <Button variant="secondary" size="md">
            Secondary md
          </Button>
          <Button variant="secondary" size="sm">
            Secondary sm
          </Button>
        </Row>
        <Row>
          <Button variant="ghost" size="md">
            Ghost md
          </Button>
          <Button variant="ghost" size="sm">
            Ghost sm
          </Button>
        </Row>
        <Row>
          <Button variant="danger" size="md">
            Danger md
          </Button>
          <Button variant="danger" size="sm">
            Danger sm
          </Button>
        </Row>
        <Button variant="primary" fullWidth>
          Full width
        </Button>
      </Section>

      <Section title="Pill — instrument (toggle)">
        <Row>
          <Pill>Inactive</Pill>
          <Pill active>Active</Pill>
          <Pill disabled>Disabled</Pill>
        </Row>
      </Section>

      <Section title="Pill — sectionType (all colors)">
        <Row>
          {sectionColorNames.map((name) => (
            <Pill
              key={name}
              variant="sectionType"
              color={SECTION_COLORS_BY_NAME[name]}
            >
              {name}
            </Pill>
          ))}
        </Row>
      </Section>

      <Section title="Checkbox">
        <Row>
          <Checkbox
            checked={checked1}
            onChange={(e) => setChecked1(e.target.checked)}
            label="Unchecked by default"
          />
          <Checkbox
            checked={checked2}
            onChange={(e) => setChecked2(e.target.checked)}
            label="Checked by default"
          />
          <Checkbox label="Disabled" disabled />
          <Checkbox label="Disabled + checked" disabled checked readOnly />
        </Row>
      </Section>

      <Section title="TextInput — standard + recessed">
        <TextInput
          placeholder="Standard input…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <TextInput variant="recessed" placeholder="Recessed input…" />
        <TextInput placeholder="Disabled" disabled />
      </Section>

      <Section title="TextArea — standard + recessed">
        <TextArea
          rows={3}
          placeholder="Standard textarea…"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
        <TextArea variant="recessed" rows={3} placeholder="Recessed textarea…" />
      </Section>

      <Section title="VoiceInput — mic button (Web Speech API)">
        <Row>
          <VoiceInput
            onTranscript={(t) =>
              setVoiceText((v) => (v ? `${v} ` : '') + t.trim())
            }
          />
          <span className="text-text-secondary" style={{ fontSize: 13 }}>
            {voiceText || 'Tap the mic and speak — transcript appears here.'}
          </span>
        </Row>
        <p className="text-text-tertiary" style={{ fontSize: 11 }}>
          Hidden entirely in browsers without the Web Speech API (e.g. Firefox).
        </p>
      </Section>

      <Section title="Card — variants">
        <Card>
          <div
            className="text-text-primary font-semibold"
            style={{ fontSize: 15, letterSpacing: '-0.2px' }}
          >
            Default card
          </div>
          <p
            className="text-text-secondary mt-xs"
            style={{ fontSize: 13, lineHeight: 1.5 }}
          >
            Plan card, section card, session history card. 18px padding,
            10px radius, 1px border.
          </p>
        </Card>

        <Card variant="suggestion" icon={<Lightbulb size={12} strokeWidth={2.5} />}>
          <div
            className="font-semibold"
            style={{ fontSize: 13, color: 'var(--amber-text)' }}
          >
            Suggestion card
          </div>
          <p
            className="mt-xs"
            style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--amber-text-muted)' }}
          >
            Pre-session coaching nudge. Amber chip on the left,
            short rationale on the right.
          </p>
        </Card>

        <Card variant="coaching">
          A short post-session reflection from the coaching engine. No border,
          coaching-bg, 13px text on coaching-text.
        </Card>

        <Card variant="hint">
          In-session hint card. 11px text on text-secondary, left rail
          accent, recessed background.
        </Card>
      </Section>

      <Section title="SectionPip — all colors">
        <Row>
          {sectionColorNames.map((name) => (
            <div key={name} className="flex items-center gap-xs">
              <SectionPip color={SECTION_COLORS_BY_NAME[name]} />
              <span
                className="text-text-secondary"
                style={{ fontSize: 11 }}
              >
                {name}
              </span>
            </div>
          ))}
        </Row>
      </Section>

      <Section title="ProgressBar — values">
        <div className="space-y-md">
          <ProgressBar value={0} label="Empty" />
          <ProgressBar value={0.25} label="25%" />
          <ProgressBar value={0.6} label="60%" />
          <ProgressBar value={1} label="Full" />
        </div>
      </Section>

      <Section title="RotationBar — configurations">
        <div className="space-y-md">
          <div>
            <p
              className="text-text-tertiary mb-xs"
              style={{ fontSize: 11 }}
            >
              3-session rotation, on session 2
            </p>
            <RotationBar total={3} current={2} label="2 of 3" />
          </div>
          <div>
            <p
              className="text-text-tertiary mb-xs"
              style={{ fontSize: 11 }}
            >
              5-session rotation, just started
            </p>
            <RotationBar total={5} current={1} label="1 of 5" />
          </div>
          <div>
            <p
              className="text-text-tertiary mb-xs"
              style={{ fontSize: 11 }}
            >
              7-session rotation, complete
            </p>
            <RotationBar total={7} current={7} label="7 of 7" />
          </div>
        </div>
      </Section>

      <Section title="RotationDots — Today rotation position">
        <Row>
          <RotationDots total={3} current={2} />
          <RotationDots total={5} current={1} />
          <RotationDots total={7} current={7} />
        </Row>
      </Section>

      <Section title="StatCard — session summary row">
        <div className="grid grid-cols-3 gap-md">
          <StatCard value="42" label="Minutes practiced" />
          <StatCard value="6" label="Exercises completed" />
          <StatCard value="3" label="Day streak" />
        </div>
      </Section>
    </div>
  )
}

function ThemeScope({
  mode,
  children,
}: {
  mode: 'light' | 'dark'
  children: ReactNode
}) {
  return (
    <div
      data-theme={mode}
      className="bg-page-bg text-text-primary px-4xl py-3xl"
    >
      <p
        className="text-text-tertiary uppercase mb-lg"
        style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.8px' }}
      >
        {mode}
      </p>
      {children}
    </div>
  )
}

export default function PreviewContent() {
  return (
    <main className="min-h-screen bg-page-bg">
      <header className="px-4xl pt-3xl pb-lg border-b border-border-default">
        <h1
          className="text-text-primary font-semibold"
          style={{ fontSize: 24, letterSpacing: '-0.5px', lineHeight: 1.35 }}
        >
          UI primitives preview
        </h1>
        <p
          className="text-text-secondary mt-xs"
          style={{ fontSize: 13, lineHeight: 1.5 }}
        >
          Dev-only — auto-redirects to /today in production. Each primitive
          renders in both light and dark scope.
        </p>
      </header>
      <div className="grid md:grid-cols-2">
        <ThemeScope mode="light">
          <Showcase />
        </ThemeScope>
        <ThemeScope mode="dark">
          <Showcase />
        </ThemeScope>
      </div>
    </main>
  )
}
