# Tensor v2 CLI

Interactive terminal GUI for managing Tensor decks and reviews.

## Features

- 🎴 **Deck Management**: Create, view, and delete decks
- 📝 **Card Management**: Add cards with front/back content
- 📚 **Review System**: Interactive review sessions with spaced repetition
- 📊 **Statistics**: View deck and global statistics
- 💾 **Persistence**: All decks and cards are saved to `.tensor/decks/`

## Usage

Run the CLI with:

```bash
bun run cli
```

Or:

```bash
npm run cli
```

## Navigation

The CLI provides an interactive menu system:

1. **Create New Deck** - Set up a new deck with custom retention targets and capacity
2. **Select Deck** - Manage a specific deck (add cards, view cards, review)
3. **Review Cards** - Review all due cards across all decks
4. **View Statistics** - See global and per-deck statistics
5. **Exit** - Save and exit

## Deck Configuration

When creating a deck, you can configure:

- **Default Retention Target** (0.75-0.97): Target recall probability
- **Daily Capacity**: Maximum cards to review per day

## Review Process

During reviews:

1. See the question (card front)
2. Press Enter to reveal the answer
3. Select your performance: Again, Hard, Good, or Easy
4. Tensor updates the card's memory state and schedules the next review

## Data Storage

All data is stored in `.tensor/decks/`:

- `{deckId}.json` - Deck configuration and card memory states
- `{deckId}_metadata.json` - Card front/back content

## Example Workflow

1. Create a deck (e.g., "Spanish Vocabulary")
2. Add cards with questions and answers
3. Review cards when they're due
4. Tensor automatically schedules next reviews based on your performance
5. View statistics to track your progress

