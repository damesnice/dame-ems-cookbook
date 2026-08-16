// Seeded the first time /api/pantry is fetched and nothing's been saved yet.
// Once the family edits it (adds/removes anything), their version is what's
// stored — this is just a generous starting point so nobody starts from zero.
// Items pulled together from Instacart's grocery-category breakdown
// (https://company.instacart.com/ideas/grocery-list-categories) plus common
// pantry-staple lists, reorganized to fit a home cookbook rather than a
// full supermarket run (household/pet/baby aisles dropped).
export const DEFAULT_PANTRY = {
  categories: [
    {
      name: "Produce",
      items: [
        "Apples", "Avocados", "Bananas", "Berries", "Cherries", "Grapes",
        "Grapefruit", "Kiwi", "Lemons", "Limes", "Melon", "Nectarines",
        "Oranges", "Peaches", "Pears", "Plums", "Asparagus", "Beets",
        "Broccoli", "Cabbage", "Carrot", "Cauliflower", "Celery", "Corn",
        "Cucumbers", "Eggplant", "Garlic", "Ginger", "Green Onions", "Kale",
        "Lettuce", "Salad Greens", "Onions", "Red Onion", "Bell Peppers",
        "Jalapeño", "Potatoes", "Spinach", "Sweet Potato", "Tomatoes",
        "Cherry Tomatoes", "Zucchini", "Mushrooms", "Cilantro", "Parsley",
      ],
    },
    {
      name: "Dairy & Eggs",
      items: [
        "Butter", "Unsalted Butter", "Cheddar Cheese", "Shredded Cheddar",
        "Cream Cheese", "Cottage Cheese", "Eggs", "Feta Cheese", "Milk",
        "Sour Cream", "Yogurt", "Greek Yogurt", "Plain Yogurt",
        "Whipped Cream", "Mozzarella", "Parmesan", "Low-fat Cheese",
        "Heavy Cream",
      ],
    },
    {
      name: "Meat & Seafood",
      items: [
        "Bacon", "Ground Beef", "Chicken Breast", "Chicken Thighs", "Cod",
        "Deli Meat", "Deli Turkey", "Ham", "Hot Dogs", "Salmon", "Sausage",
        "Steak", "Tuna", "Turkey", "Ground Turkey", "Pork Chops", "Shrimp",
      ],
    },
    {
      name: "Meat Alternatives",
      items: [
        "Paneer", "Quorn", "Soy Burgers", "Soy Hot Dogs", "Tempeh", "Tofu",
        "Veggie Burgers",
      ],
    },
    {
      name: "Grains, Pasta & Bread",
      items: [
        "Bread", "Bagels", "Croissants", "Hamburger Buns", "Hot Dog Buns",
        "Muffins", "Pita Bread", "Tortillas", "Flour Tortillas",
        "Corn Tortillas", "Wraps", "Breakfast Cereal", "Couscous",
        "Granola", "Lasagna Noodles", "Macaroni", "Oats", "Rolled Oats",
        "Pasta", "Spaghetti", "Quinoa", "Rice", "White Rice", "Brown Rice",
        "Rice Noodles", "Vermicelli",
      ],
    },
    {
      name: "Canned & Jarred",
      items: [
        "Apple Sauce", "Baked Beans", "Black Beans", "Pinto Beans",
        "Chicken Broth", "Beef Broth", "Canned Fruit", "Canned Carrots",
        "Chickpeas", "Diced Tomatoes", "Creamed Corn", "Jam or Jelly",
        "Lentils", "Olives", "Pasta Sauce", "Tomato Sauce", "Tomato Paste",
        "Peas", "Peanut Butter", "Pickles", "Pie Filling", "Soup",
        "Coconut Milk",
      ],
    },
    {
      name: "Condiments & Sauces",
      items: [
        "BBQ Sauce", "Chutney", "Honey", "Horseradish", "Hot Sauce",
        "Ketchup", "Mayonnaise", "Mustard", "Relish", "Salad Dressing",
        "Ranch Dressing", "Salsa", "Soy Sauce", "Steak Sauce",
        "Sweet and Sour Sauce", "Teriyaki Sauce", "Worcestershire Sauce",
        "Maple Syrup", "Sriracha", "Lemon Juice",
      ],
    },
    {
      name: "Spices & Seasonings",
      items: [
        "Basil", "Bay Leaves", "BBQ Seasoning", "Black Pepper",
        "Cajun Seasoning", "Cinnamon", "Cloves", "Cumin", "Curry Powder",
        "Coriander", "Garlic Powder", "Garlic Salt", "Italian Seasoning",
        "Oregano", "Paprika", "Smoked Paprika", "Red Pepper Flakes",
        "Sage", "Salt", "Chili Powder", "Onion Powder", "Taco Seasoning",
        "Thyme", "Rosemary",
      ],
    },
    {
      name: "Baking",
      items: [
        "All-purpose Flour", "Sugar", "Brown Sugar", "Powdered Sugar",
        "Baking Powder", "Baking Soda", "Vanilla Extract", "Vanilla Sugar",
        "Cocoa Powder", "Chocolate Chips", "Yeast", "Cornstarch",
      ],
    },
    {
      name: "Oils & Vinegars",
      items: [
        "Olive Oil", "Vegetable Oil", "Canola Oil", "Sesame Oil",
        "Coconut Oil", "Rice Bran Oil", "Cooking Spray", "Balsamic Vinegar",
        "Apple Cider Vinegar", "White Vinegar", "Rice Vinegar",
      ],
    },
    {
      name: "Frozen",
      items: [
        "Frozen Chicken", "Frozen Fish", "Ice Cream", "Ice Pops",
        "Frozen Pies", "Frozen Pizza", "Waffles", "Frozen Peas",
        "Frozen Corn", "Frozen Mixed Vegetables", "Frozen Berries",
        "Frozen Fruit", "Frozen Shrimp", "Frozen French Fries",
      ],
    },
    {
      name: "Nuts, Snacks & Sweets",
      items: [
        "Almonds", "Candy", "Cashews", "Cookies", "Crackers", "Dried Fruit",
        "Granola Bars", "Popcorn", "Potato Chips", "Pretzels", "Pudding",
        "Seeds", "Tortilla Chips", "Walnuts", "Peanuts", "Raisins",
      ],
    },
    {
      name: "Beverages",
      items: [
        "Beer", "Club Soda", "Coconut Water", "Coffee", "Energy Drinks",
        "Juice", "Orange Juice", "Kombucha", "Soft Drinks", "Tea",
        "Sparkling Water", "Wine",
      ],
    },
  ],
};
