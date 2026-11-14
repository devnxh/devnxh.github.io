---
title: CineWatch
summary: "Content-based movie recommender using TF-IDF and cosine similarity."
stack: [Python, Flask, pandas, scikit-learn, NumPy, jQuery, Bootstrap 5]
repo: https://github.com/devnxh/movie-recommender-v2
demo: https://movie-recommender-v2-htgt.onrender.com/
order: 5
tags: [python, machine-learning]
---

CineWatch is a Flask web app that recommends films similar to one you pick.

## How it works

1. Each film's genres, keywords and plot overview are joined into one text.
2. scikit-learn turns that text into TF-IDF vectors, capped at 5,000 features.
3. The chosen film is compared with every other film by cosine similarity, and the closest matches are returned.

The data comes from the TMDB movie dataset (v11). The processed TF-IDF matrix is cached as a sparse matrix, so it is not rebuilt on every start.

## Features

- Search with suggestions.
- Filtering by genre.
- A watchlist.
- Film details from the TMDB API when an API key is set: cast, directors, age rating and trailer.

## Running it on a free plan

The hosted demo on Render loads a 1,000-film sample instead of the full dataset, to stay within the free plan's memory.

> [!todo] TODO
> Devansh: add when you built this, whether it was a solo or a team project, and what you learned from it. The repository does not say.
