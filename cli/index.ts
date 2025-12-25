/**
 * Tensor v2 CLI Application
 * 
 * Interactive terminal GUI for managing Tensor decks and reviews.
 */

import chalk from "chalk"
import prompts from "prompts"
import { createTensor } from "../src/tensor"
import type { Deck, Card } from "../src/tensor"
import type { MemoryState, ReviewOutcome, DeckConfig } from "../src/tensor"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "fs"
import { join } from "path"

// Decks are stored in .tensor/decks in the project root
const DECKS_DIR = join(process.cwd(), ".tensor", "decks")

// Ensure decks directory exists
if (!existsSync(DECKS_DIR)) {
  mkdirSync(DECKS_DIR, { recursive: true })
}

const tensor = createTensor()

/**
 * Load all decks from disk
 * 
 * @returns Map of deck ID to Deck instance
 */
function loadDecks(): Map<string, Deck> {
  const decks = new Map<string, Deck>()
  
  if (!existsSync(DECKS_DIR)) {
    return decks
  }

  const files = readdirSync(DECKS_DIR).filter(f => f.endsWith(".json"))
  
  for (const file of files) {
    try {
      const filePath = join(DECKS_DIR, file)
      const data = JSON.parse(readFileSync(filePath, "utf-8"))
      const deck = tensor.createDeck(data.name, data.config)
      
      // Restore cards
      if (data.cards) {
        for (const cardData of data.cards) {
          deck.addCard(
            cardData.id,
            cardData.memoryState,
            new Date(cardData.due)
          )
        }
      }
      
      decks.set(deck.id, deck)
    } catch (error) {
      console.error(chalk.red(`Error loading deck from ${file}: ${error}`))
    }
  }
  
  return decks
}

/**
 * Save a deck to disk
 * 
 * @param deck - The deck to save
 */
function saveDeck(deck: Deck): void {
  const filePath = join(DECKS_DIR, `${deck.id}.json`)
  const cards = deck.getAllCards().map(card => ({
    id: card.id,
    memoryState: card.memoryState,
    due: card.due.toISOString(),
    lastReviewed: card.lastReviewed?.toISOString(),
    reviewCount: card.reviewCount,
  }))
  
  const data = {
    id: deck.id,
    name: deck.name,
    config: deck.config,
    cards,
  }
  
  writeFileSync(filePath, JSON.stringify(data, null, 2))
}

// Delete a deck from disk
function deleteDeck(deckId: string): void {
  const filePath = join(DECKS_DIR, `${deckId}.json`)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
  // Also delete metadata file
  const metadataPath = join(DECKS_DIR, `${deckId}_metadata.json`)
  if (existsSync(metadataPath)) {
    unlinkSync(metadataPath)
  }
}

/**
 * Display the main menu and handle user interaction
 * 
 * @param decks - Map of all loaded decks
 */
async function showMainMenu(decks: Map<string, Deck>): Promise<void> {
  console.clear()
  console.log(chalk.bold.cyan("╔═══════════════════════════════════════╗"))
  console.log(chalk.bold.cyan("║        Tensor v2 - Deck Manager        ║"))
  console.log(chalk.bold.cyan("╚═══════════════════════════════════════╝"))
  console.log()

  const deckList = Array.from(decks.values())
  
  if (deckList.length > 0) {
    console.log(chalk.bold("Your Decks:"))
    deckList.forEach((deck, index) => {
      const stats = deck.updateStatistics()
      console.log(
        `  ${chalk.cyan(index + 1 + ".")} ${chalk.bold(deck.name)} ` +
        `${chalk.gray(`(${stats.totalCards} cards, ${stats.dueToday} due)`)}`
      )
    })
    console.log()
  } else {
    console.log(chalk.yellow("No decks yet. Create one to get started!"))
    console.log()
  }

  const { action } = await prompts({
    type: "select",
    name: "action",
    message: "What would you like to do?",
    choices: [
      { title: "Create New Deck", value: "create" },
      { title: "Select Deck", value: "select", disabled: deckList.length === 0 },
      { title: "Review Cards", value: "review", disabled: deckList.length === 0 },
      { title: "View Statistics", value: "stats", disabled: deckList.length === 0 },
      { title: "Exit", value: "exit" },
    ],
  })

  if (!action) {
    process.exit(0)
  }

  switch (action) {
    case "create":
      await createDeck(decks)
      break
    case "select":
      await selectDeck(decks)
      break
    case "review":
      await reviewCards(decks)
      break
    case "stats":
      await showStatistics(decks)
      break
    case "exit":
      console.log(chalk.green("Goodbye!"))
      process.exit(0)
  }

  // Return to main menu
  await showMainMenu(decks)
}

// Create a new deck
async function createDeck(decks: Map<string, Deck>): Promise<void> {
  console.clear()
  console.log(chalk.bold.cyan("Create New Deck"))
  console.log()

  const { name, retentionTargetStr, dailyCapacityStr } = await prompts([
    {
      type: "text",
      name: "name",
      message: "Deck name:",
      validate: (value: string) => value.length > 0 || "Name cannot be empty",
    },
    {
      type: "text",
      name: "retentionTargetStr",
      message: "Default retention target (0.75-0.97):",
      initial: "0.90",
      validate: (value: string) => {
        const num = parseFloat(value)
        if (isNaN(num)) return "Must be a number"
        if (num < 0.75 || num > 0.97) return "Must be between 0.75 and 0.97"
        return true
      },
    },
    {
      type: "text",
      name: "dailyCapacityStr",
      message: "Daily capacity (cards per day):",
      initial: "50",
      validate: (value: string) => {
        const num = parseInt(value)
        if (isNaN(num)) return "Must be a number"
        if (num < 1) return "Must be at least 1"
        return true
      },
    },
  ])

  const retentionTarget = retentionTargetStr ? parseFloat(retentionTargetStr) : 0.90
  const dailyCapacity = dailyCapacityStr ? parseInt(dailyCapacityStr) : 50

  if (!name) return

  const config: DeckConfig = {
    defaultRetentionTarget: retentionTarget,
    defaultDailyCapacity: dailyCapacity,
  }

  const deck = tensor.createDeck(name, config)
  decks.set(deck.id, deck)
  saveDeck(deck)

  console.log(chalk.green(`\n✓ Deck "${name}" created successfully!`))
  await prompts({
    type: "confirm",
    name: "continue",
    message: "Press Enter to continue...",
    initial: true,
  })
}

// Select and manage a deck
async function selectDeck(decks: Map<string, Deck>): Promise<void> {
  console.clear()
  console.log(chalk.bold.cyan("Select Deck"))
  console.log()

  const deckList = Array.from(decks.values())
  const { deckIndex } = await prompts({
    type: "select",
    name: "deckIndex",
    message: "Choose a deck:",
    choices: deckList.map((deck, index) => ({
      title: `${deck.name} (${deck.getCardCount()} cards)`,
      value: index,
    })),
  })

  if (deckIndex === undefined) return

  const deck = deckList[deckIndex]
  await manageDeck(deck, decks)
}

// Manage a specific deck
async function manageDeck(deck: Deck, decks: Map<string, Deck>): Promise<void> {
  console.clear()
  console.log(chalk.bold.cyan(`Deck: ${deck.name}`))
  console.log()

  const stats = deck.updateStatistics()
  console.log(chalk.bold("Statistics:"))
  console.log(`  Total cards: ${chalk.cyan(stats.totalCards)}`)
  console.log(`  Due today: ${chalk.yellow(stats.dueToday)}`)
  console.log(`  Backlog: ${chalk.red(stats.backlogSize)}`)
  console.log(`  Average stability: ${chalk.cyan(stats.averageStability.toFixed(2))} days`)
  console.log(`  Load ratio: ${chalk.yellow(stats.loadRatio.toFixed(2))}`)
  console.log()

  const { action } = await prompts({
    type: "select",
    name: "action",
    message: "What would you like to do?",
    choices: [
      { title: "Add Card", value: "add" },
      { title: "View Cards", value: "view" },
      { title: "Review Cards", value: "review" },
      { title: "Delete Deck", value: "delete" },
      { title: "Back to Main Menu", value: "back" },
    ],
  })

  if (!action) return

  switch (action) {
    case "add":
      await addCard(deck)
      break
    case "view":
      await viewCards(deck)
      break
    case "review":
      await reviewDeckCards(deck)
      break
    case "delete":
      await deleteDeckPrompt(deck, decks)
      break
    case "back":
      return
  }

  await manageDeck(deck, decks)
}

// Add a card to a deck
async function addCard(deck: Deck): Promise<void> {
  console.clear()
  console.log(chalk.bold.cyan(`Add Card to ${deck.name}`))
  console.log()

  const { front, back, initialStabilityStr, difficultyStr } = await prompts([
    {
      type: "text",
      name: "front",
      message: "Card front (question/prompt):",
      validate: (value: string) => value.length > 0 || "Cannot be empty",
    },
    {
      type: "text",
      name: "back",
      message: "Card back (answer):",
      validate: (value: string) => value.length > 0 || "Cannot be empty",
    },
    {
      type: "text",
      name: "initialStabilityStr",
      message: "Initial stability (days):",
      initial: "1",
      validate: (value: string) => {
        const num = parseFloat(value)
        if (isNaN(num)) return "Must be a number"
        if (num < 0.1) return "Must be at least 0.1"
        return true
      },
    },
    {
      type: "text",
      name: "difficultyStr",
      message: "Difficulty (0-10):",
      initial: "5",
      validate: (value: string) => {
        const num = parseFloat(value)
        if (isNaN(num)) return "Must be a number"
        if (num < 0 || num > 10) return "Must be between 0 and 10"
        return true
      },
    },
  ])

  const initialStability = initialStabilityStr ? parseFloat(initialStabilityStr) : 1
  const difficulty = difficultyStr ? parseFloat(difficultyStr) : 5

  if (!front || !back) return

  const cardId = `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const memoryState: MemoryState = {
    S: initialStability,
    difficulty,
    t: 0,
  }
  const due = new Date()

  deck.addCard(cardId, memoryState, due)
  saveDeck(deck)

  // Store card metadata (front/back) separately
  const metadataPath = join(DECKS_DIR, `${deck.id}_metadata.json`)
  let metadata: any = {}
  if (existsSync(metadataPath)) {
    metadata = JSON.parse(readFileSync(metadataPath, "utf-8"))
  }
  metadata[cardId] = { front, back }
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

  console.log(chalk.green(`\n✓ Card added successfully!`))
  await prompts({
    type: "confirm",
    name: "continue",
    message: "Press Enter to continue...",
    initial: true,
  })
}

// View cards in a deck
async function viewCards(deck: Deck): Promise<void> {
  console.clear()
  console.log(chalk.bold.cyan(`Cards in ${deck.name}`))
  console.log()

  const cards = deck.getAllCards()
  const now = new Date()

  if (cards.length === 0) {
    console.log(chalk.yellow("No cards in this deck."))
  } else {
      cards.forEach((card, index) => {
        const status = card.isOverdue(now)
          ? chalk.red("OVERDUE")
          : card.isDue(now)
          ? chalk.yellow("DUE")
          : chalk.green("UPCOMING")

        console.log(
          `  ${chalk.cyan(index + 1 + ".")} Card ${chalk.gray(card.id)} ` +
          `S=${chalk.cyan(card.memoryState.S.toFixed(2))} ` +
          `Due: ${chalk.gray(card.due.toLocaleDateString())} ` +
          status
        )
      })
  }

  console.log()
  await prompts({
    type: "confirm",
    name: "continue",
    message: "Press Enter to continue...",
    initial: true,
  })
}

// Review cards in a deck
async function reviewDeckCards(deck: Deck): Promise<void> {
  console.clear()
  console.log(chalk.bold.cyan(`Review Cards in ${deck.name}`))
  console.log()

  const now = new Date()
  const nextCards = deck.getNextReview(10)

  if (nextCards.length === 0) {
    console.log(chalk.yellow("No cards due for review!"))
    await prompts({
      type: "confirm",
      name: "continue",
      message: "Press Enter to continue...",
      initial: true,
    })
    return
  }

  // Load card metadata
  const metadataPath = join(DECKS_DIR, `${deck.id}_metadata.json`)
  let metadata: any = {}
  if (existsSync(metadataPath)) {
    metadata = JSON.parse(readFileSync(metadataPath, "utf-8"))
  }

  let reviewed = 0
  for (const card of nextCards) {
    const cardMeta = metadata[card.id] || { front: "Question", back: "Answer" }

    console.clear()
    console.log(chalk.bold.cyan(`Review ${reviewed + 1}/${nextCards.length}`))
    console.log()
    console.log(chalk.bold("Question:"))
    console.log(`  ${chalk.white(cardMeta.front)}`)
    console.log()

    await prompts({
      type: "confirm",
      name: "showAnswer",
      message: "Press Enter to show answer...",
      initial: true,
    })

    console.log(chalk.bold("Answer:"))
    console.log(`  ${chalk.green(cardMeta.back)}`)
    console.log()

    const { grade } = await prompts({
      type: "select",
      name: "grade",
      message: "How did you do?",
      choices: [
        { title: "Again (Forgot)", value: "Again" },
        { title: "Hard", value: "Hard" },
        { title: "Good", value: "Good" },
        { title: "Easy", value: "Easy" },
      ],
    })

    if (!grade) break

    const sessionContext = {
      reviewsSoFarInSession: reviewed,
    }

    const result = deck.processReview(card.id, grade as ReviewOutcome, sessionContext, now)
    saveDeck(deck)

    console.log()
    console.log(chalk.green(`✓ Reviewed! Next review in ${result.schedulingSuggestion.nextInterval.toFixed(1)} days`))
    console.log()

    reviewed++

    const { continueReview } = await prompts({
      type: "confirm",
      name: "continueReview",
      message: "Continue reviewing?",
      initial: true,
    })

    if (!continueReview) break
  }

  console.log(chalk.green(`\n✓ Reviewed ${reviewed} card(s)!`))
  await prompts({
    type: "confirm",
    name: "continue",
    message: "Press Enter to continue...",
    initial: true,
  })
}

// Review cards across all decks
async function reviewCards(decks: Map<string, Deck>): Promise<void> {
  const deckList = Array.from(decks.values())
  const now = new Date()

  // Find all due cards across all decks
  const allDueCards: Array<{ deck: Deck; card: Card }> = []
  for (const deck of deckList) {
    const cards = deck.getNextReview(10)
    for (const card of cards) {
      allDueCards.push({ deck, card })
    }
  }

  if (allDueCards.length === 0) {
    console.clear()
    console.log(chalk.yellow("No cards due for review!"))
    await prompts({
      type: "confirm",
      name: "continue",
      message: "Press Enter to continue...",
      initial: true,
    })
    return
  }

  // Sort by priority (overdue first)
  allDueCards.sort((a, b) => {
    const aOverdue = a.card.isOverdue(now) ? 1 : 0
    const bOverdue = b.card.isOverdue(now) ? 1 : 0
    return bOverdue - aOverdue
  })

  console.clear()
  console.log(chalk.bold.cyan("Review Session"))
  console.log(`Found ${chalk.yellow(allDueCards.length)} card(s) due for review`)
  console.log()

  // Load metadata for all decks
  const metadataMap = new Map<string, any>()
  for (const deck of deckList) {
    const metadataPath = join(DECKS_DIR, `${deck.id}_metadata.json`)
    if (existsSync(metadataPath)) {
      metadataMap.set(deck.id, JSON.parse(readFileSync(metadataPath, "utf-8")))
    }
  }

  let reviewed = 0
  for (const { deck, card } of allDueCards) {
    const metadata = metadataMap.get(deck.id) || {}
    const cardMeta = metadata[card.id] || { front: "Question", back: "Answer" }

    console.clear()
    console.log(chalk.bold.cyan(`Review ${reviewed + 1}/${allDueCards.length}`))
    console.log(`Deck: ${chalk.gray(deck.name)}`)
    console.log()
    console.log(chalk.bold("Question:"))
    console.log(`  ${chalk.white(cardMeta.front)}`)
    console.log()

    await prompts({
      type: "confirm",
      name: "showAnswer",
      message: "Press Enter to show answer...",
      initial: true,
    })

    console.log(chalk.bold("Answer:"))
    console.log(`  ${chalk.green(cardMeta.back)}`)
    console.log()

    const { grade } = await prompts({
      type: "select",
      name: "grade",
      message: "How did you do?",
      choices: [
        { title: "Again (Forgot)", value: "Again" },
        { title: "Hard", value: "Hard" },
        { title: "Good", value: "Good" },
        { title: "Easy", value: "Easy" },
      ],
    })

    if (!grade) break

    const sessionContext = {
      reviewsSoFarInSession: reviewed,
    }

    const result = deck.processReview(card.id, grade as ReviewOutcome, sessionContext, now)
    saveDeck(deck)

    console.log()
    console.log(chalk.green(`✓ Reviewed! Next review in ${result.schedulingSuggestion.nextInterval.toFixed(1)} days`))
    console.log()

    reviewed++

    const { continueReview } = await prompts({
      type: "confirm",
      name: "continueReview",
      message: "Continue reviewing?",
      initial: true,
    })

    if (!continueReview) break
  }

  console.log(chalk.green(`\n✓ Reviewed ${reviewed} card(s)!`))
  await prompts({
    type: "confirm",
    name: "continue",
    message: "Press Enter to continue...",
    initial: true,
  })
}

// Show statistics
async function showStatistics(decks: Map<string, Deck>): Promise<void> {
  console.clear()
  console.log(chalk.bold.cyan("Global Statistics"))
  console.log()

  const globalStats = tensor.getGlobalStatistics()
  console.log(chalk.bold("Overview:"))
  console.log(`  Total decks: ${chalk.cyan(globalStats.deckCount)}`)
  console.log(`  Total cards: ${chalk.cyan(globalStats.totalCards)}`)
  console.log(`  Due today: ${chalk.yellow(globalStats.totalDueToday)}`)
  console.log(`  Backlog: ${chalk.red(globalStats.totalBacklog)}`)
  console.log(`  Average stability: ${chalk.cyan(globalStats.averageStability.toFixed(2))} days`)
  console.log(`  Average failure rate: ${chalk.yellow((globalStats.averageFailureRate * 100).toFixed(1))}%`)
  console.log()

  console.log(chalk.bold("Per-Deck Statistics:"))
  for (const deck of decks.values()) {
    const stats = deck.updateStatistics()
    console.log(`  ${chalk.cyan(deck.name)}:`)
    console.log(
      `    Cards: ${chalk.white(stats.totalCards)} | ` +
      `Due: ${chalk.yellow(stats.dueToday)} | ` +
      `Backlog: ${chalk.red(stats.backlogSize)} | ` +
      `Avg S: ${chalk.cyan(stats.averageStability.toFixed(1))}`
    )
  }

  console.log()
  await prompts({
    type: "confirm",
    name: "continue",
    message: "Press Enter to continue...",
    initial: true,
  })
}

// Delete deck prompt
async function deleteDeckPrompt(deck: Deck, decks: Map<string, Deck>): Promise<void> {
  const { confirm } = await prompts({
    type: "confirm",
    name: "confirm",
    message: `Are you sure you want to delete "${chalk.red(deck.name)}"?`,
    initial: false,
  })

  if (confirm) {
    decks.delete(deck.id)
    tensor.removeDeck(deck.id)
    deleteDeck(deck.id)
    console.log(chalk.green(`\n✓ Deck "${deck.name}" deleted.`))
    await prompts({
      type: "confirm",
      name: "continue",
      message: "Press Enter to continue...",
      initial: true,
    })
  }
}

// Main entry point
async function main() {
  const decks = loadDecks()
  await showMainMenu(decks)
}

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log(chalk.green("\n\nGoodbye!"))
  process.exit(0)
})

main().catch((error) => {
  console.error(chalk.red("Error:"), error)
  process.exit(1)
})

