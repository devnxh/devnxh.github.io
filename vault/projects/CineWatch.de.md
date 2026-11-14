---
title: CineWatch
translation: machine
summary: "Inhaltsbasierte Filmempfehlung mit TF-IDF und Kosinus-Ähnlichkeit."
---

CineWatch ist eine Flask-Webanwendung, die Filme empfiehlt, die einem ausgewählten Film ähneln.

## So funktioniert es

1. Genres, Schlagwörter und Inhaltsangabe jedes Films werden zu einem Text zusammengeführt.
2. scikit-learn wandelt diesen Text in TF-IDF-Vektoren um, begrenzt auf 5.000 Merkmale.
3. Der gewählte Film wird über die Kosinus-Ähnlichkeit mit allen anderen verglichen. Die ähnlichsten Filme werden zurückgegeben.

Die Daten stammen aus dem TMDB-Filmdatensatz (v11). Die berechnete TF-IDF-Matrix wird als dünn besetzte Matrix zwischengespeichert und nicht bei jedem Start neu erzeugt.

## Funktionen

- Suche mit Vorschlägen.
- Filter nach Genre.
- Eine Merkliste.
- Filmdetails aus der TMDB-API, wenn ein API-Schlüssel gesetzt ist: Besetzung, Regie, Altersfreigabe und Trailer.

## Betrieb im kostenlosen Tarif

Die gehostete Demo auf Render lädt eine Stichprobe von 1.000 Filmen statt des vollständigen Datensatzes, damit der Arbeitsspeicher des kostenlosen Tarifs ausreicht.

> [!todo] TODO
> Devansh: Ergänze, wann du das gebaut hast, ob allein oder im Team, und was du dabei gelernt hast. Im Repository steht es nicht.
