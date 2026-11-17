# Chess Reviewer

Review a chess game with Stockfish in your browser. Paste a PGN or open a `.pgn` file to see the evaluation graph, move classifications, and a summary for both sides. Click a mistake or blunder to see the opponent's suggested reply, or select **Show best move** to compare it with what you played.

## How to use it

1. After a Chess.com game, open **Share → PGN** and copy the PGN or download it.
2. In Chess Reviewer, click **Import PGN**, paste the text or select the file, then click **Load game**.
3. Click **Analyze game**. You can navigate with the move list, graph, or left and right arrow keys while Stockfish works.
4. After analysis, review the **Game summary** or click **Next mistake** to jump between critical moves. You can also analyze the sample game without importing anything.

The PGN contains the full move history. A standalone FEN describes a single position.

## Run locally

With Node.js installed, run this command from the repository root:

```sh
node serve.mjs
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173/). The app and engine are bundled in `dist/` and work offline through the local server.

## Publish on GitHub Pages

In the repository, open **Settings → Pages** and select **GitHub Actions** as the source. The included **Deploy to GitHub Pages** workflow publishes `dist/` on pushes to `main`. You can also run it manually from the **Actions** tab.

## How analysis works

Stockfish 17.1 Lite runs in a dedicated browser worker. Games stay in the browser. Each position is searched up to depth 13 with a 10,000-node budget. The worker stops when analysis finishes or is canceled. The board uses the stored results when you move through the game or show an alternative.

Move classifications estimate the loss in evaluation for the side that moved. They use this project's thresholds and can differ from Chess.com's classifications. Explanations describe the engine's suggested continuation and observable consequences such as captures or checkmate.

Third-party source and license information is in [dist/vendor/sources.txt](dist/vendor/sources.txt).

