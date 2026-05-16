"""Per-agent component allow-list (A2UI v0.9 BasicCatalog names).

Names match exactly: Text, Image, Icon, Video, AudioPlayer, Row, Column, List,
Card, Tabs, Modal, Divider, Button, TextField, CheckBox, ChoicePicker, Slider,
DateTimeInput. (No 'Heading' — use Text with style="title". No 'Picker' — use
ChoicePicker. No 'Input' — use TextField. No 'Checkbox' — use CheckBox.)
"""

ALLOWED_COMPONENTS: dict[str, list[str]] = {
    "orchestrator":  ["Text", "Card"],
    "referral":      ["Text", "Card", "Column", "Row", "Button", "Divider"],
    "team_assembly": ["Text", "Card", "Column", "Row", "Button", "ChoicePicker", "Divider", "List"],
    "allied_health": ["Text", "Card", "Column", "Row", "Button", "CheckBox"],
    "compliance":    ["Text", "Card", "Column", "Button"],
    "outcome":       ["Text", "Card", "Column", "Row", "Button", "TextField", "ChoicePicker", "List"],
}

CATALOG_ID_V09 = "https://a2ui.org/specification/v0_9/basic_catalog.json"
A2UI_VERSION = "v0.9"
