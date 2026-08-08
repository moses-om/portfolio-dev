from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

# Create canvas 1200x627
width, height = 1200, 627
canvas = Image.new('RGB', (width, height), color='#0D1B3E')
draw = ImageDraw.Draw(canvas)

# Create sleek dark navy / maroon gradient background
for y in range(height):
    # Interpolate from deep navy (#0D1B3E) to maroon dark (#4A0F1C)
    r = int(13 + (74 - 13) * (y / height))
    g = int(27 + (15 - 27) * (y / height))
    b = int(62 + (28 - 62) * (y / height))
    draw.line([(0, y), (width, y)], fill=(r, g, b))

# Draw decorative tech subtle grid & glowing accent line
accent_color = (184, 134, 11) # Gold
draw.line([(0, 620), (width, 620)], fill=accent_color, width=7)
draw.line([(0, 0), (width, 0)], fill=(107, 26, 42), width=7)

# Draw subtle glow circle on background
glow = Image.new('RGBA', (width, height), (0,0,0,0))
glow_draw = ImageDraw.Draw(glow)
glow_draw.ellipse([700, 50, 1150, 500], fill=(107, 26, 42, 60))
glow_draw.ellipse([800, 100, 1050, 450], fill=(184, 134, 11, 40))
glow = glow.filter(ImageFilter.GaussianBlur(30))
canvas.paste(glow, (0, 0), glow)

# Load user photo moses.jpg
photo_path = 'moses.jpg'
if os.path.exists(photo_path):
    user_img = Image.open(photo_path).convert('RGBA')
    
    # Make circular portrait badge (380x380)
    badge_size = 380
    user_img_square = Image.new('RGBA', (badge_size, badge_size), (0, 0, 0, 0))
    
    # Crop center square of user_img
    min_dim = min(user_img.size)
    left = (user_img.width - min_dim) // 2
    top = (user_img.height - min_dim) // 2
    cropped = user_img.crop((left, top, left + min_dim, top + min_dim)).resize((badge_size, badge_size), Image.Resampling.LANCZOS)
    
    # Create circular mask
    mask = Image.new('L', (badge_size, badge_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse((0, 0, badge_size, badge_size), fill=255)
    
    # Paste user image with mask
    portrait = Image.new('RGBA', (badge_size, badge_size), (0, 0, 0, 0))
    portrait.paste(cropped, (0, 0), mask)
    
    # Create border ring
    ring_size = badge_size + 16
    ring = Image.new('RGBA', (ring_size, ring_size), (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring)
    ring_draw.ellipse((0, 0, ring_size, ring_size), outline=(212, 160, 23, 255), width=6)
    ring_draw.ellipse((4, 4, ring_size-4, ring_size-4), outline=(107, 26, 42, 255), width=4)
    
    # Position portrait on right side
    pos_x = 730
    pos_y = (height - badge_size) // 2
    
    canvas.paste(ring, (pos_x - 8, pos_y - 8), ring)
    canvas.paste(portrait, (pos_x, pos_y), portrait)

# Try loading truetype fonts, fallback to default if not present
try:
    font_name = ImageFont.truetype("arial.ttf", 52)
    font_title = ImageFont.truetype("arial.ttf", 30)
    font_sub = ImageFont.truetype("arial.ttf", 22)
    font_badge = ImageFont.truetype("arial.ttf", 18)
except Exception:
    font_name = ImageFont.load_default()
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()
    font_badge = ImageFont.load_default()

# Text overlay on Left Side
txt_draw = ImageDraw.Draw(canvas)

# Pill Badge
badge_box = [80, 110, 390, 145]
txt_draw.rounded_rectangle(badge_box, radius=17, fill=(107, 26, 42, 200), outline=(212, 160, 23), width=1)
txt_draw.text((100, 117), "DATA PORTFOLIO 2026", fill='#D4A017', font=font_badge)

# Main Name
txt_draw.text((80, 175), "Moses Omondi", fill='#FFFFFF', font=font_name)

# Title
txt_draw.text((80, 250), "Business Intelligence &\nData Engineering", fill='#F8F8F8', font=font_title)

# Description / Location
txt_draw.text((80, 355), "• Business Analytics & Insights\n• Automated ETL / Data Pipelines\n• Nairobi, Kenya", fill='#D0D8E8', font=font_sub)

# Domain URL Box
url_box = [80, 475, 590, 530]
txt_draw.rounded_rectangle(url_box, radius=8, fill=(21, 37, 84), outline=(184, 134, 11), width=2)
txt_draw.text((100, 492), "🌐 moses-om.github.io/portfolio-dev", fill='#FFFFFF', font=font_sub)

# Save composite og-image.png
canvas.save('og-image.png', 'PNG')
print("Successfully generated og-image.png featuring moses.jpg!")

# Also generate favicon.png featuring user's face in circular badge
if os.path.exists(photo_path):
    fav_size = 512
    fav = Image.new('RGBA', (fav_size, fav_size), (13, 27, 62, 255))
    fav_draw = ImageDraw.Draw(fav)
    
    # Outer ring
    fav_draw.ellipse((10, 10, fav_size-10, fav_size-10), outline=(212, 160, 23), width=12)
    
    # Face crop
    cropped_fav = user_img.crop((left, top, left + min_dim, top + min_dim)).resize((fav_size - 40, fav_size - 40), Image.Resampling.LANCZOS)
    fav_mask = Image.new('L', (fav_size - 40, fav_size - 40), 0)
    fav_mask_draw = ImageDraw.Draw(fav_mask)
    fav_mask_draw.ellipse((0, 0, fav_size - 40, fav_size - 40), fill=255)
    
    fav.paste(cropped_fav, (20, 20), fav_mask)
    fav.save('favicon.png', 'PNG')
    print("Successfully generated favicon.png featuring moses.jpg!")
