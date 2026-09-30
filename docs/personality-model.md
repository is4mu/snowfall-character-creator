# Personality Model v1

## Status

This document defines the first draft of the Snowfall Character Creator personality model, identified in serialized character data as:

```text
scc-personality-v1
```

The model is intended for **fictional character authoring and simulation input**, not for psychological diagnosis or assessment of real people.

## Design goals

The model should be:

- detailed enough to create meaningfully different behavior;
- compact enough to remain understandable and editable;
- continuous rather than type-based;
- neutral about which end of a trait is "better";
- stable enough to serialize as part of Character Schema v1;
- usable without any questionnaire;
- compatible with questionnaire-assisted creation later;
- independent from a particular LLM, game engine, or Life Engine implementation.

## Why 30 traits

Five broad personality dimensions are useful summaries, but they collapse distinctions that matter for character behavior.

For example:

- enjoying people is different from asserting oneself;
- understanding another person's feelings is different from wanting to help;
- becoming angry easily is different from taking a long time to recover;
- seeking excitement is different from acting rashly under strong emotion;
- wanting status is different from being unfair;
- fearing rejection is different from avoiding intimacy.

The v1 model therefore stores 30 narrower canonical traits.

Broad summaries may be shown in the UI, but they are **derived views** and are not persisted as duplicate sources of truth.

## Trait scale

Every canonical trait is represented as a number from `0.0` to `1.0`.

```text
0.0 ---------------- 0.5 ---------------- 1.0
low endpoint         middle               high endpoint
```

The scale is continuous.

Values near `0.0` or `1.0` are not errors and are not inherently pathological. They simply represent stronger authoring tendencies.

## Canonical domains and traits

### 1. Openness

| Trait | 0.0 direction | 1.0 direction |
| --- | --- | --- |
| `intellectualCuriosity` | prefers familiar/practical information | actively seeks ideas, explanations, and knowledge |
| `creativeImagination` | concrete and literal | imaginative and hypothetical |
| `aestheticSensitivity` | less affected by aesthetic qualities | strongly notices beauty, style, art, and atmosphere |
| `unconventionality` | prefers familiar norms and established approaches | comfortable exploring unusual ideas and approaches |

### 2. Self-regulation

| Trait | 0.0 direction | 1.0 direction |
| --- | --- | --- |
| `orderliness` | comfortable with loose structure and disorder | strongly prefers organization, routines, and structure |
| `diligence` | conserves effort or disengages sooner | sustains effort and follows tasks through |
| `deliberation` | decides quickly with less forethought | routinely considers consequences and alternatives |

### 3. Social

| Trait | 0.0 direction | 1.0 direction |
| --- | --- | --- |
| `sociability` | prefers solitude or limited social contact | actively seeks and enjoys social interaction |
| `assertiveness` | yielding, deferential, unlikely to lead | readily states needs, takes initiative, and leads |
| `socialConfidence` | self-conscious or hesitant under social exposure | comfortable being seen, evaluated, or meeting unfamiliar people |
| `activityLevel` | relaxed, slower, lower-activity pace | energetic, busy, high-activity pace |
| `emotionalExpressiveness` | feelings are less outwardly visible | feelings are readily shown in words, face, tone, or behavior |

### 4. Interpersonal

| Trait | 0.0 direction | 1.0 direction |
| --- | --- | --- |
| `empathy` | less spontaneously attuned to others' perspectives and feelings | readily notices and understands others' emotional perspectives |
| `compassion` | less automatically motivated to relieve distress | strongly inclined to care for and help people who are struggling |
| `trust` | cautious and skeptical about others' intentions | readily assumes goodwill until evidence suggests otherwise |
| `forgiveness` | grievances persist and trust is slow to restore | resentment fades more readily after repair |
| `respectfulness` | more willing to be blunt or disregard etiquette/boundaries | strongly attentive to courtesy, consent, and boundaries |

### 5. Integrity

| Trait | 0.0 direction | 1.0 direction |
| --- | --- | --- |
| `sincerity` | more willing to manage impressions or manipulate for advantage | strongly prefers genuine, non-manipulative interaction |
| `fairness` | more willing to exploit unfair opportunities | strongly avoids cheating, exploitation, and unfair advantage |

### 6. Emotional

| Trait | 0.0 direction | 1.0 direction |
| --- | --- | --- |
| `anxietyProneness` | rarely enters anticipatory worry | readily experiences worry and threat-focused anticipation |
| `irritability` | slow to become annoyed or angry | frustration and anger are triggered relatively easily |
| `sadnessProneness` | less prone to sadness after setback or loss | strongly affected by disappointment, rejection, or loss |
| `moodVolatility` | mood changes gradually and remains relatively stable | mood shifts rapidly or intensely in response to events |
| `recoverySpeed` | strong emotions linger | returns toward emotional baseline relatively quickly |

### 7. Behavioral motivation

| Trait | 0.0 direction | 1.0 direction |
| --- | --- | --- |
| `statusMotivation` | relatively indifferent to prestige, rank, and recognition | strongly motivated by visible success, prestige, rank, or recognition |
| `rewardSensitivity` | immediate reward and praise exert a weaker pull | strongly approaches anticipated rewards and positive reinforcement |
| `sensationSeeking` | prefers familiar, lower-intensity stimulation | seeks novelty, excitement, intensity, and stimulation |
| `emotionalUrgency` | retains behavioral control during intense emotion | more likely to act rashly when emotion is very strong |

### 8. Attachment

| Trait | 0.0 direction | 1.0 direction |
| --- | --- | --- |
| `attachmentAnxiety` | relatively secure about close others' availability | highly sensitive to rejection/abandonment and reassurance needs |
| `attachmentAvoidance` | comfortable with closeness, disclosure, and reliance | strongly prefers distance, self-reliance, or reduced intimacy |

## Canonical versus derived concepts

The model deliberately avoids storing broad or redundant fields when they can be derived from narrower traits.

Examples of **derived concepts** include:

- broad openness;
- broad conscientiousness;
- broad extraversion;
- broad agreeableness;
- broad emotional stability;
- risk propensity;
- conflict style;
- social approach tendency;
- relationship insecurity;
- behavioral inhibition under stress.

For example, a downstream system could estimate risk propensity from some combination of:

- `sensationSeeking`;
- `rewardSensitivity`;
- `deliberation`;
- `anxietyProneness`;
- current context and stakes.

The exact formula is **not** part of Personality Model v1. Different downstream systems may interpret the same stable trait vector differently.

## Why some earlier candidates were removed

Several useful-sounding traits were not retained as independent canonical fields because they overlap strongly with other traits or belong to another character domain.

| Candidate | v1 treatment |
| --- | --- |
| cognitive flexibility | derived from openness traits and context |
| novelty seeking | represented primarily by sensation seeking plus openness |
| persistence | folded into diligence |
| self-discipline | folded into diligence and deliberation |
| general impulsivity | decomposed into deliberation and emotional urgency |
| social adaptability | derived from social confidence, empathy, respectfulness, and context |
| cooperativeness | derived from compassion, fairness, respectfulness, and goals |
| competitiveness | derived from status motivation, reward sensitivity, assertiveness, and context |
| stress tolerance | derived from emotional traits plus context |
| risk tolerance | derived rather than persisted |
| approval need | largely represented by attachment anxiety, social confidence, and status motivation |
| autonomy need | treated as a value/motive outside core personality |
| control need | treated as context-sensitive and potentially derivable from anxiety/orderliness |
| current mood | runtime state, not personality |
| current relationship trust | relationship state, not baseline personality trust |

## Personality is not the whole character

A realistic character also needs information that must remain separate from personality.

### Values

What the character considers important.

Examples:

- family;
- achievement;
- freedom;
- tradition;
- wealth;
- romance;
- security.

### Preferences

What the character likes and dislikes.

Examples:

- foods;
- fashion;
- music;
- hobbies;
- environments.

### Goals

What the character is currently trying to achieve.

Goals are expected to change over time and should not be encoded as stable traits.

### Background and experiences

Life history explains why a character reacts in certain ways and may influence future state.

It should not be collapsed into personality.

### Skills and capabilities

A character can be highly diligent but unskilled, or highly empathic but poor at reading a specific social cue because of limited information.

Ability and tendency are different concepts.

## Interaction with runtime state

Personality is a **baseline tendency**, not a direct action command.

A downstream simulation should generally combine:

```text
personality
+ values
+ preferences
+ goals
+ memories / history
+ relationship state
+ current emotion
+ physical state
+ environment
+ available actions
= action tendency
```

This allows the same character to behave differently across contexts without changing their underlying personality every moment.

## Questionnaire-assisted creation

A future questionnaire may estimate the canonical 30-trait vector.

The intended flow is:

```text
question responses
      |
      v
scoring / inference
      |
      v
30 canonical traits
      |
      v
manual review and adjustment
```

Question responses, scoring-session metadata, and intermediate questionnaire state are editor workflow data. They are not canonical character data.

A questionnaire must not be required in order to create or edit a character.

## Type labels

MBTI-style or archetype labels may be offered as optional summaries or discovery tools.

They must not become the source of truth.

Two characters with the same label may still have meaningfully different 30-trait vectors.

## Research influences

The SCC model is an original engineering model rather than a direct implementation of an existing psychological inventory.

Its structure is informed by several established lines of personality research:

- facet-level Big Five models, including the BFI-2's use of narrower facets beneath broad domains;
- HEXACO research, especially distinctions involving sincerity, fairness, and broad interpersonal behavior;
- multidimensional impulsivity research such as UPPS-P, which distinguishes rash action under strong emotion from planning and stimulation seeking;
- dimensional adult attachment research, which commonly represents attachment insecurity using anxiety and avoidance dimensions.

References:

- Big Five Inventory / BFI-2 overview: https://www.ocf.berkeley.edu/~johnlab/bfi.html
- HEXACO scale descriptions: https://hexaco.org/scaledescriptions
- ECR-R overview by R. Chris Fraley: https://labs.psychology.illinois.edu/~rcfraley/measures/ecrr.htm

## Questionnaire and licensing boundary

Snowfall Character Creator does **not** copy third-party personality inventory questions, answer keys, scoring keys, or protected test content into this model.

The names and high-level concepts of personality traits are used as scientific design references only.

Any future SCC questionnaire intended for public or commercial use should use independently authored questions and an independently documented scoring model unless explicit permission is obtained for third-party material.

## Open questions before stable v1

The following should be tested before the personality model is frozen:

1. whether `emotionalUrgency` should remain one dimension or split into positive and negative urgency;
2. whether `empathy` and `compassion` remain behaviorally distinct in simulation;
3. whether `statusMotivation` needs a separate material-reward dimension;
4. whether `recoverySpeed` behaves as a stable enough authoring trait;
5. whether all 30 traits can be explained clearly in a creator UI;
6. whether random generation produces believable covariance rather than independent random sliders;
7. whether a Life Engine adapter can use the traits without inventing hidden personality state.

## v1 rule

Until evidence from creator and simulation prototypes suggests otherwise:

> Store the 30 narrow traits as canonical personality data. Derive broad summaries and context-specific action tendencies elsewhere.
