
const API_URL = '/api';

export const api = {
    // Products
    getProducts: () => fetch(`${API_URL}/products`).then(r => r.json()),
    addProduct: (product) => fetch(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
    }).then(r => r.json()),
    updateProduct: (id, product) => fetch(`${API_URL}/products/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
    }).then(r => r.json()),
    deleteProduct: (id) => fetch(`${API_URL}/products/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r => r.json()),

    // Categories
    getCategories: () => fetch(`${API_URL}/categories`).then(r => r.json()),
    addCategory: (name) => fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    }).then(r => r.json()),
    deleteCategory: (name) => fetch(`${API_URL}/categories/${encodeURIComponent(name)}`, { method: 'DELETE' }).then(r => r.json()),

    // Ingredients
    getIngredients: () => fetch(`${API_URL}/ingredients`).then(r => r.json()),
    addIngredient: (ingredient) => fetch(`${API_URL}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingredient)
    }).then(r => r.json()),
    updateIngredient: (id, ingredient) => fetch(`${API_URL}/ingredients/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingredient)
    }).then(r => r.json()),
    deleteIngredient: (id) => fetch(`${API_URL}/ingredients/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r => r.json()),

    // Recipes
    getRecipe: (productId) => fetch(`${API_URL}/recipes/${encodeURIComponent(productId)}`).then(r => r.json()),
    addRecipeItem: (recipeItem) => fetch(`${API_URL}/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeItem)
    }).then(r => r.json()),
    deleteRecipeItem: (productId, ingredientId) => fetch(`${API_URL}/recipes/${encodeURIComponent(productId)}/${encodeURIComponent(ingredientId)}`, { method: 'DELETE' }).then(r => r.json()),

    // Orders
    createOrder: (order) => fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
    }).then(r => r.json()),
};
