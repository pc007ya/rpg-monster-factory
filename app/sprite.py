from pathlib import Path
from PIL import Image


def split_horizontal_sheet(
    source_path: Path,
    output_dir: Path,
    frame_count: int,
    action: str,
) -> list[Path]:
    if frame_count <= 0:
        raise ValueError("frame_count 必須大於 0")

    image = Image.open(source_path).convert("RGBA")
    width, height = image.size

    if width % frame_count != 0:
        raise ValueError(
            f"圖片寬度 {width}px 無法平均切成 {frame_count} 幀。"
            f"請使用寬度可整除幀數的 sprite sheet。"
        )

    frame_width = width // frame_count
    output_dir.mkdir(parents=True, exist_ok=True)

    for old in output_dir.glob(f"{action}_*.png"):
        old.unlink()

    generated = []
    for index in range(frame_count):
        frame = image.crop(
            (
                index * frame_width,
                0,
                (index + 1) * frame_width,
                height,
            )
        )
        target = output_dir / f"{action}_{index:02d}.png"
        frame.save(target, "PNG")
        generated.append(target)

    return generated
