
import React, { useState, useRef, useEffect } from 'react';
import { Product, Category, Order } from '../types';
import { Icons } from '../constants';
import { api } from '../services/api';

interface ProductManagementProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  restaurantName: string;
  eventType: string;
  onUpdateSettings: (name: string, type: string) => void;
  onRestoreDatabase: (data: any) => void;
}

interface BackupPreview {
  products: Product[];
  categories: Category[];
  orders: Order[];
  restaurantName: string;
  eventType: string;
  fileName: string;
}

const ProductManagement: React.FC<ProductManagementProps> = ({
  products,
  setProducts,
  categories,
  setCategories,
  orders,
  setOrders,
  restaurantName,
  eventType,
  onUpdateSettings,
  onRestoreDatabase
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'ingredients' | 'recipes' | 'general'>('products');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General Settings Form
  const [formRestName, setFormRestName] = useState(restaurantName);
  const [formEventType, setFormEventType] = useState(eventType);

  // Backup Import State
  const [preview, setPreview] = useState<BackupPreview | null>(null);

  // Google Drive Status State
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [backupLog, setBackupLog] = useState<any[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Sync internal form with props when they change (critical for imports)
  useEffect(() => {
    setFormRestName(restaurantName);
    setFormEventType(eventType);
  }, [restaurantName, eventType]);

  // Product Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [category, setCategory] = useState<Category>('');

  // Category Form State
  const [newCatName, setNewCatName] = useState('');

  // Confirmation State
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'product' | 'category' | 'ingredient' | 'alert' } | null>(null);

  // Ingredient State
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [ingName, setIngName] = useState('');
  const [ingUnit, setIngUnit] = useState('pz');
  const [ingCost, setIngCost] = useState(0);
  const [ingStock, setIngStock] = useState(0);

  // Recipe State
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<string | null>(null);
  const [currentRecipe, setCurrentRecipe] = useState<any[]>([]);

  // Fetch data on tab change or mount
  useEffect(() => {
    if (activeTab === 'ingredients') {
      api.getIngredients().then(setIngredients);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'recipes' && selectedProductForRecipe) {
      api.getRecipe(selectedProductForRecipe).then(setCurrentRecipe);
    }
  }, [activeTab, selectedProductForRecipe]);

  // Load Drive status + log when on general tab
  useEffect(() => {
    if (activeTab !== 'general') return;
    fetch('/api/auth/google/status')
      .then(r => r.json())
      .then(d => setDriveConnected(d.authenticated))
      .catch(() => setDriveConnected(false));
    fetch('/api/backup/log')
      .then(r => r.json())
      .then(setBackupLog)
      .catch(() => setBackupLog([]));
  }, [activeTab]);

  const handleDriveBackup = async () => {
    setIsBackingUp(true);
    setBackupMessage(null);
    try {
      const res = await fetch('/api/backup/drive', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setBackupMessage({ text: `✅ Respaldo guardado: ${data.fileName}`, ok: true });
        // Refresh log
        const log = await fetch('/api/backup/log').then(r => r.json());
        setBackupLog(log);
      } else {
        setBackupMessage({ text: `❌ Error: ${data.error}`, ok: false });
      }
    } catch (e) {
      setBackupMessage({ text: '❌ Error de conexión con el servidor', ok: false });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!name || price <= 0 || !category) return;

    try {
      if (editingId) {
        await api.updateProduct(editingId, { name, price, category });
        setProducts(prev => prev.map(p =>
          p.id === editingId ? { ...p, name, price, category } : p
        ));
        setEditingId(null);
      } else {
        const id = Date.now().toString();
        const newProduct = { id, name, price, category };
        await api.addProduct(newProduct);
        setProducts(prev => [...prev, newProduct]);
        setIsAdding(false);
      }
      resetProductForm();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const resetProductForm = () => {
    setName('');
    setPrice(0);
    setCategory(categories[0] || '');
  };

  const startEditProduct = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setPrice(p.price);
    setCategory(p.category);
    setIsAdding(false);
  };

  const deleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      setConfirmDelete(null);
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleAddCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      alert('Esta categoría ya existe.');
      return;
    }
    try {
      await api.addCategory(trimmed);
      setCategories(prev => [...prev, trimmed]);
      setNewCatName('');
    } catch (error) {
      console.error('Error adding category:', error);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    try {
      await api.deleteCategory(cat);
      setCategories(prev => prev.filter(c => c !== cat));
      setConfirmDelete(null);
    } catch (error) {
      console.error('Error deleting category:', error);
    }
  };

  const handleSaveGeneral = () => {
    onUpdateSettings(formRestName, formEventType);
    alert('Configuración actualizada');
  };

  // Ingredient Logic
  const handleSaveIngredient = async () => {
    if (!ingName || ingCost < 0) return;
    try {
      if (editingIngredientId) {
        await api.updateIngredient(editingIngredientId, { name: ingName, unit: ingUnit, cost: ingCost, stock: ingStock });
        setIngredients(prev => prev.map(i => i.id === editingIngredientId ? { ...i, name: ingName, unit: ingUnit, cost: ingCost, stock: ingStock } : i));
        setEditingIngredientId(null);
      } else {
        const id = Date.now().toString();
        const newIng = { id, name: ingName, unit: ingUnit, cost: ingCost, stock: ingStock };
        await api.addIngredient(newIng);
        setIngredients(prev => [...prev, newIng]);
        setIsAddingIngredient(false);
      }
      resetIngredientForm();
    } catch (error) {
      console.error('Error saving ingredient:', error);
    }
  };

  const resetIngredientForm = () => {
    setIngName('');
    setIngUnit('pz');
    setIngCost(0);
    setIngStock(0);
  };

  const deleteIngredient = async (id: string) => {
    try {
      await api.deleteIngredient(id);
      setIngredients(prev => prev.filter(i => i.id !== id));
      setConfirmDelete(null);
    } catch (error) {
      console.error('Error deleting ingredient:', error);
    }
  };

  // Recipe Logic
  const handleAddRecipeItem = async (ingredientId: string, quantity: number) => {
    if (!selectedProductForRecipe || !ingredientId || quantity <= 0) return;
    try {
      await api.addRecipeItem({ product_id: selectedProductForRecipe, ingredient_id: ingredientId, quantity });
      const recipe = await api.getRecipe(selectedProductForRecipe);
      setCurrentRecipe(recipe);
    } catch (error) {
      console.error('Error adding recipe item:', error);
    }
  };

  const deleteRecipeItem = async (ingredientId: string) => {
    if (!selectedProductForRecipe) return;
    try {
      await api.deleteRecipeItem(selectedProductForRecipe, ingredientId);
      setCurrentRecipe(prev => prev.filter(r => r.ingredient_id !== ingredientId));
    } catch (error) {
      console.error('Error deleting recipe item:', error);
    }
  };

  // BACKUP LOGIC
  const handleExportData = () => {
    const data = {
      products,
      categories,
      orders,
      restaurantName,
      eventType,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comanda_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Validaciones básicas de estructura
        if (!data.products || !data.categories) {
          throw new Error("El archivo no es un respaldo válido de Comanda Eventos.");
        }

        setPreview({
          products: data.products || [],
          categories: data.categories || [],
          orders: data.orders || [],
          restaurantName: data.restaurantName || restaurantName,
          eventType: data.eventType || eventType,
          fileName: file.name
        });
      } catch (err) {
        console.error("Error al leer archivo:", err);
        alert('Error al procesar el archivo: ' + (err instanceof Error ? err.message : 'Formato inválido'));
        setPreview(null);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const applyBackup = () => {
    if (!preview) return;

    if (confirm('ATENCIÓN: Se borrarán todos los datos actuales y se reemplazarán por los del respaldo. ¿Continuar?')) {
      try {
        onRestoreDatabase(preview);
        alert('Base de datos restaurada con éxito.');
        setPreview(null);
        // Opcional: Volver a la pestaña de productos para ver el cambio
        setActiveTab('products');
      } catch (error) {
        console.error("Error durante applyBackup:", error);
        alert("Ocurrió un error al aplicar el respaldo.");
      }
    }
  };

  return (
    <div className="p-2 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Custom Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl scale-in-center overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-red-600"></div>
            <h3 className="text-lg font-black uppercase tracking-tighter mb-2">
              {confirmDelete.type === 'alert' ? 'No se puede eliminar' : '¿Estás seguro?'}
            </h3>
            <p className="text-slate-500 text-sm mb-6 font-medium">
              {confirmDelete.type === 'alert' ? confirmDelete.id : 'Esta acción no se puede deshacer y afectará a los datos relacionados.'}
            </p>
            <div className="flex flex-col gap-2">
              {confirmDelete.type !== 'alert' && (
                <button
                  onClick={() => {
                    if (confirmDelete.type === 'product') deleteProduct(confirmDelete.id);
                    else if (confirmDelete.type === 'category') handleDeleteCategory(confirmDelete.id);
                    else if (confirmDelete.type === 'ingredient') deleteIngredient(confirmDelete.id);
                  }}
                  className="w-full bg-red-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition"
                >
                  Confirmar Eliminación
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(null)}
                className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition"
              >
                {confirmDelete.type === 'alert' ? 'Entendido' : 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex space-x-1 bg-slate-200 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('products')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition ${activeTab === 'products' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:bg-slate-300'}`}
        >
          Productos
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition ${activeTab === 'categories' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:bg-slate-300'}`}
        >
          Categorías
        </button>
        <button
          onClick={() => setActiveTab('ingredients')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition ${activeTab === 'ingredients' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:bg-slate-300'}`}
        >
          Ingredientes
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition ${activeTab === 'recipes' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:bg-slate-300'}`}
        >
          Recetas
        </button>
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition ${activeTab === 'general' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:bg-slate-300'}`}
        >
          General
        </button>
      </div>

      {activeTab === 'products' && (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Menú de Ventas</h2>
            {!isAdding && !editingId && (
              <button
                onClick={() => {
                  setIsAdding(true);
                  if (categories.length > 0) setCategory(categories[0]);
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center space-x-2 hover:bg-red-700 transition shadow-lg shadow-red-100"
              >
                <Icons.Plus /> <span>Nuevo</span>
              </button>
            )}
          </div>

          {(isAdding || editingId) && (
            <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-red-600 shadow-xl animate-in zoom-in duration-200">
              <h3 className="font-black text-black uppercase tracking-widest mb-4 sm:mb-6 border-b pb-2 text-sm sm:text-base">{editingId ? 'Editar' : 'Agregar'} Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Item</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio</label>
                  <input
                    type="number" value={price} onChange={e => setPrice(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</label>
                  <select
                    value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 sm:mt-8 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2 sm:gap-0">
                <button
                  onClick={() => { setIsAdding(false); setEditingId(null); resetProductForm(); }}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveProduct}
                  className="w-full sm:w-auto px-10 py-3 sm:py-2 bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-lg"
                >
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* Responsive Product List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            {/* Desktop Table */}
            <table className="w-full text-left hidden lg:table">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoría</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Precio</th>
                  <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {products.map(product => (
                  <tr key={product.id} className="hover:bg-red-50/30 transition-colors">
                    <td className="p-4 font-bold text-slate-900 text-sm">{product.name}</td>
                    <td className="p-4">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded border border-slate-300 uppercase bg-white text-slate-600">
                        {product.category}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-black text-sm">${product.price}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end space-x-1">
                        <button onClick={() => startEditProduct(product)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition"><Icons.Edit /></button>
                        <button onClick={() => setConfirmDelete({ id: product.id, type: 'product' })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Icons.Trash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card List */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {products.map(product => (
                <div key={product.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{product.name}</p>
                    <p className="text-xs font-bold text-black mt-1">${product.price}</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button onClick={() => startEditProduct(product)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded-lg transition"><Icons.Edit /></button>
                    <button onClick={() => setConfirmDelete({ id: product.id, type: 'product' })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Icons.Trash /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-6">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Categorías</h2>
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-4 sm:space-y-6">
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="Nueva categoría..."
                className="flex-grow p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-600 outline-none"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddCategory()}
              />
              <button
                onClick={handleAddCategory}
                className="bg-black text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-lg"
              >
                <span>Añadir</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map(cat => (
                <div key={cat} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 group transition hover:border-red-600 hover:bg-white">
                  <span className="font-bold text-slate-800 text-sm uppercase tracking-tight">{cat}</span>
                  <button
                    onClick={() => {
                      const inUse = products.some(p => p.category === cat);
                      if (inUse) {
                        setConfirmDelete({ id: `La categoría "${cat}" está siendo usada por algunos productos. Debes cambiarlos de categoría primero.`, type: 'alert' });
                        return;
                      }
                      setConfirmDelete({ id: cat, type: 'category' });
                    }}
                    className="p-2 text-slate-300 hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ingredients' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Inventario de Ingredientes</h2>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              {!isAddingIngredient && !editingIngredientId && (
                <button
                  onClick={() => setIsAddingIngredient(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest flex items-center space-x-2"
                >
                  <Icons.Plus /> <span>Nuevo</span>
                </button>
              )}
            </div>

            {(isAddingIngredient || editingIngredientId) && (
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-red-600 space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre</label>
                    <input type="text" value={ingName} onChange={e => setIngName(e.target.value)} className="p-2 rounded-xl border" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidad</label>
                    <select value={ingUnit} onChange={e => setIngUnit(e.target.value)} className="p-2 rounded-xl border">
                      <option value="pz">pz</option>
                      <option value="kg">kg</option>
                      <option value="gr">gr</option>
                      <option value="lt">lt</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo Unit.</label>
                    <input type="number" value={ingCost} onChange={e => setIngCost(Number(e.target.value))} className="p-2 rounded-xl border" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock</label>
                    <input type="number" value={ingStock} onChange={e => setIngStock(Number(e.target.value))} className="p-2 rounded-xl border" />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button onClick={() => { setIsAddingIngredient(false); setEditingIngredientId(null); resetIngredientForm(); }} className="px-4 py-2 text-xs font-black">Cancelar</button>
                  <button onClick={handleSaveIngredient} className="bg-black text-white px-6 py-2 rounded-xl text-xs font-black uppercase">Guardar</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-[10px] font-black text-slate-400 uppercase">Ingrediente</th>
                    <th className="p-2 text-[10px] font-black text-slate-400 uppercase">Unidad</th>
                    <th className="p-2 text-[10px] font-black text-slate-400 uppercase">Costo</th>
                    <th className="p-2 text-[10px] font-black text-slate-400 uppercase text-right">Stock</th>
                    <th className="p-2 text-[10px] font-black text-slate-400 uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map(ing => (
                    <tr key={ing.id} className="border-b last:border-0">
                      <td className="p-2 font-bold text-sm">{ing.name}</td>
                      <td className="p-2 text-sm">{ing.unit}</td>
                      <td className="p-2 font-black text-sm">${ing.cost}</td>
                      <td className="p-2 text-right font-bold text-sm">{ing.stock}</td>
                      <td className="p-2 text-right">
                        <button onClick={() => { setEditingIngredientId(ing.id); setIngName(ing.name); setIngUnit(ing.unit); setIngCost(ing.cost); setIngStock(ing.stock); }} className="p-1 text-slate-400 hover:text-black"><Icons.Edit /></button>
                        <button onClick={() => setConfirmDelete({ id: ing.id, type: 'ingredient' })} className="p-1 text-slate-400 hover:text-red-600"><Icons.Trash /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'recipes' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Recetas y Costeo</h2>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Seleccionar Producto</h3>
                <div className="border rounded-xl divide-y max-h-96 overflow-y-auto">
                  {products.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProductForRecipe(p.id)}
                      className={`w-full p-3 text-left text-sm font-bold transition ${selectedProductForRecipe === p.id ? 'bg-red-600 text-white' : 'hover:bg-slate-50'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                {selectedProductForRecipe ? (
                  <>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ingredientes de la Receta</h3>
                    <div className="flex gap-2">
                      <select id="recipeIngSelect" className="flex-grow p-2 rounded-xl border">
                        <option value="">Seleccionar ingrediente...</option>
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                        ))}
                      </select>
                      <input id="recipeQtyInput" type="number" placeholder="Cant." className="w-20 p-2 rounded-xl border" />
                      <button
                        onClick={() => {
                          const id = (document.getElementById('recipeIngSelect') as HTMLSelectElement).value;
                          const qty = Number((document.getElementById('recipeQtyInput') as HTMLInputElement).value);
                          handleAddRecipeItem(id, qty);
                        }}
                        className="bg-black text-white px-4 py-2 rounded-xl text-xs font-black uppercase"
                      >
                        Añadir
                      </button>
                    </div>

                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Ingrediente</th>
                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Cantidad</th>
                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Costo Sub.</th>
                            <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {currentRecipe.map(item => (
                            <tr key={item.ingredient_id}>
                              <td className="p-3 text-sm font-bold">{item.ingredient_name}</td>
                              <td className="p-3 text-sm">{item.quantity} {item.unit}</td>
                              <td className="p-3 text-sm font-black">${(item.quantity * item.cost).toFixed(2)}</td>
                              <td className="p-3 text-right">
                                <button onClick={() => deleteRecipeItem(item.ingredient_id)} className="text-slate-400 hover:text-red-600"><Icons.Trash /></button>
                              </td>
                            </tr>
                          ))}
                          {currentRecipe.length > 0 && (
                            <tr className="bg-slate-50 font-black">
                              <td colSpan={2} className="p-3 text-right text-xs uppercase">Costo Teórico Total:</td>
                              <td className="p-3 text-red-600">${currentRecipe.reduce((acc, item) => acc + (item.quantity * item.cost), 0).toFixed(2)}</td>
                              <td></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center border-2 border-dashed rounded-2xl p-10 text-slate-400 text-center">
                    <p className="text-xs uppercase font-black tracking-widest">Selecciona un producto a la izquierda para ver su receta</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-400 pb-10">
          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Ajustes del Negocio</h2>
            <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border-2 border-black shadow-2xl space-y-6 sm:space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nombre del Negocio</label>
                  <div className="relative">
                    <div className="absolute left-3 top-3.5 text-red-600 opacity-50"><Icons.ChefHat /></div>
                    <input
                      type="text"
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-black text-black"
                      value={formRestName}
                      onChange={e => setFormRestName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo de Evento</label>
                  <div className="relative">
                    <div className="absolute left-3 top-3.5 text-red-600 opacity-50"><Icons.MapPin /></div>
                    <input
                      type="text"
                      className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-50 border-0 ring-1 ring-slate-200 focus:ring-2 focus:ring-black outline-none font-bold text-slate-700"
                      value={formEventType}
                      onChange={e => setFormEventType(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 sm:pt-4 flex sm:justify-end">
                <button
                  onClick={handleSaveGeneral}
                  className="w-full sm:w-auto bg-red-600 text-white px-8 sm:px-12 py-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-[0.2em] hover:bg-red-700 transition shadow-2xl shadow-red-200"
                >
                  Actualizar
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Respaldo de Datos</h2>
            <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleExportData}
                  className="flex-1 bg-black text-white px-6 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition shadow-xl flex flex-col items-center justify-center space-y-3"
                >
                  <div className="scale-150 mb-1"><Icons.FileText /></div>
                  <span>Exportar Base de Datos</span>
                </button>

                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full bg-slate-100 text-slate-700 px-6 py-6 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition border-2 border-dashed border-slate-300 flex flex-col items-center justify-center space-y-3"
                  >
                    <div className="scale-150 mb-1 rotate-180"><Icons.FileText /></div>
                    <span>Seleccionar Archivo</span>
                  </button>
                </div>
              </div>

              {/* PREVIEW AREA */}
              {preview && (
                <div className="mt-6 bg-slate-50 rounded-2xl sm:rounded-3xl border-2 border-red-600 p-4 sm:p-6 animate-in zoom-in duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-black text-black uppercase tracking-widest text-xs">Previsualización del Respaldo</h4>
                    <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-red-600 transition"><Icons.Trash /></button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Archivo</p>
                      <p className="text-[10px] font-bold truncate">{preview.fileName}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Productos</p>
                      <p className="text-lg font-black">{preview.products.length}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Categorías</p>
                      <p className="text-lg font-black">{preview.categories.length}</p>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Órdenes</p>
                      <p className="text-lg font-black">{preview.orders.length}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-xl border border-slate-200 mb-6">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Ajustes a aplicar:</p>
                    <p className="text-[10px] font-black uppercase tracking-tight text-red-600">{preview.restaurantName} / {preview.eventType}</p>
                  </div>

                  <button
                    onClick={applyBackup}
                    className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center space-x-3 shadow-2xl shadow-red-200 hover:bg-red-700 transition"
                  >
                    <Icons.CheckCircle />
                    <span>APLICAR ESTE RESPALDO</span>
                  </button>
                </div>
              )}

              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-start space-x-3">
                <div className="text-red-600 pt-0.5 scale-90"><Icons.Settings /></div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-red-800 tracking-wider">¡Atención!</p>
                  <p className="text-[10px] text-red-700 leading-relaxed font-medium">
                    Use estas funciones para guardar su progreso. El sistema almacena datos localmente, por lo que limpiar la caché del navegador borrará su información si no tiene un respaldo.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Google Drive Status ───────────────────────────────────────── */}
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter">Google Drive</h2>
            <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm space-y-6">

              {/* Connection status badge */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${driveConnected === null ? 'bg-slate-300 animate-pulse' :
                      driveConnected ? 'bg-emerald-500' : 'bg-red-500'
                    }`} />
                  <div>
                    <p className="font-black text-sm text-slate-900">
                      {driveConnected === null ? 'Verificando...' :
                        driveConnected ? 'Conectado a Google Drive' : 'No conectado'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {driveConnected
                        ? 'Los respaldos se guardarán en tu cuenta de Google Drive'
                        : 'Conecta tu cuenta para habilitar respaldos en la nube'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  {!driveConnected && (
                    <a
                      href="/api/auth/google"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition shadow-lg flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                      Conectar con Google
                    </a>
                  )}
                  <button
                    onClick={handleDriveBackup}
                    disabled={!driveConnected || isBackingUp}
                    className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-700 transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isBackingUp ? (
                      <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" strokeOpacity={0.3} /><path d="M21 12c0-4.97-4.03-9-9-9" /></svg> Guardando...</>
                    ) : (
                      <><Icons.FileText /> Respaldar Ahora</>
                    )}
                  </button>
                </div>
              </div>

              {/* Feedback message */}
              {backupMessage && (
                <div className={`px-4 py-3 rounded-xl text-xs font-bold ${backupMessage.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
                  }`}>
                  {backupMessage.text}
                </div>
              )}

              {/* Backup log */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Historial de Respaldos</p>
                {backupLog.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-4 text-center">Sin respaldos registrados aún</p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                    {backupLog.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-bold text-slate-700 truncate max-w-[180px]">{entry.fileName}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium flex-shrink-0">
                          {new Date(entry.timestamp).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default ProductManagement;
