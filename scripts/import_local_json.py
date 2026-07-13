from app.storage import storage


if __name__ == "__main__":
    items = storage.import_inbox()
    print(f"Imported {len(items)} monster JSON files.")
