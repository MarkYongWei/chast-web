"use client";

import { useState, useEffect, useRef } from "react";
import { apiService } from "../../services/api";
// @ts-ignore
import AddTrainingModal from "./AddTrainingModal";
import Link from "next/link";
import Image from "next/image";
// @ts-ignore
import ImportTrainingModal from "./ImportTrainingModal";
import * as XLSX from 'xlsx';
import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';
// 导入SqlReviewPanel组件
import SqlReviewPanel from "./SqlReviewPanel";

interface TrainingData {
  id: string;
  action: string;
  question: string;
  content: string;
  trainingDataType: string;
  answer?: string;
  sql?: string;
  ddl?: string;
  documentation?: string;
  solution?: string;
}

interface SqlReview {
  id: string;
  question: string;
  sql: string;
  result: any;
  explanation?: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

type DataType = "all" | "sql" | "ddl" | "documentation" | "solution";

export default function TrainingDataPage() {
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedType, setSelectedType] = useState<DataType>("all");
  const [expandedContent, setExpandedContent] = useState<string | null>(null);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [expandedAnswer, setExpandedAnswer] = useState<string | null>(null);
  const exportButtonRef = useRef<HTMLDivElement>(null);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [userRole, setUserRole] = useState<'admin' | 'employee' | null>(null);
  const router = useRouter();
  
  // 搜索相关状态
  const [searchTerm, setSearchTerm] = useState("");
  const [searchField, setSearchField] = useState<"question" | "content" | "all">("all");
  
  // 批量删除相关状态
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // SQL审核相关状态
  const [showReviewTab, setShowReviewTab] = useState(false);
  const [pendingReviews, setPendingReviews] = useState<SqlReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  // 检查登录状态
  useEffect(() => {
    const role = Cookies.get('userRole');
    if (!role) {
      router.push('/login');
    } else if (role === 'employee') {
      // 如果是普通员工，重定向到首页
      router.push('/');
    } else {
      setUserRole(role as 'admin' | 'employee');
    }
  }, [router]);

  // 处理登出
  const handleLogout = () => {
    // 清除 cookie
    Cookies.remove('userRole');
    // 强制刷新页面，这样中间件会自动重定向到登录页
    window.location.href = '/login';
  };

  // 加载训练数据
  const loadTrainingData = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getTrainingData();
      console.log('response', response);
      
      // 确保响应数据正确处理，包括支持示例中直接传入的数据格式
      let dataToProcess = response;
      
      // 如果response不是数组但有df属性，尝试使用df
      if (!Array.isArray(response) && response?.df) {
        dataToProcess = typeof response.df === 'string' 
          ? JSON.parse(response.df) 
          : response.df;
      }
      
      // 转换数据格式
      const formattedData: TrainingData[] = Array.isArray(dataToProcess) 
        ? dataToProcess.map((item: any) => {
            // 处理训练数据类型，确保一致性
            let dataType = (item.training_data_type || "未知").toLowerCase();
            
            // 标准化所有类型，确保一致性
            if (dataType === "doc" || dataType === "文档" || dataType.includes("document") || dataType.includes("文档")) {
              dataType = "documentation";
            } else if (dataType === "sql") {
              dataType = "sql";
            } else if (dataType === "ddl") {
              dataType = "ddl";
            } else if (dataType === "solution" || dataType === "解题步骤") {
              dataType = "solution";
              // 确保解题步骤类型的数据正确设置 content
              if (item.content === undefined || item.content === null) {
                item.content = item.answer || "";
              }
            }
            
            console.log(`原始类型: ${item.training_data_type}, 标准化类型: ${dataType}`);
            
            return {
              id: item.id || Math.random().toString(36).substring(2),
              action: "delete",
              question: item.question !== null ? item.question : "",
              content: item.trainingDataType === "solution" ? (item.solution || "") : (item.content || ""),
              trainingDataType: dataType,
              answer: item.answer || undefined,
              sql: item.sql || undefined,
              ddl: item.ddl || undefined,
              documentation: item.documentation || undefined,
              solution: item.solution || undefined
            };
          })
        : [];
      
      // console.log('格式化后的数据:', formattedData);
      setTrainingData(formattedData);
      setTotalItems(formattedData.length);
    } catch (error) {
      console.error("加载训练数据失败:", error);
      // 设置一些模拟数据用于测试
      const mockData: TrainingData[] = [
        {
          id: "1",
          action: "delete",
          question: "查询岗位信息表下的所有信息",
          content: "SELECT * FROM `abc_t_gx_gwxx`;",
          trainingDataType: "sql",
          answer: "SELECT * FROM `abc_t_gx_gwxx`;",
          sql: "SELECT * FROM `abc_t_gx_gwxx`;"
        },
        {
          id: "2",
          action: "delete",
          question: "",
          content: "岗位信息表 is abc_t_gx_gwxx",
          trainingDataType: "documentation",
          answer: "岗位信息表 is abc_t_gx_gwxx",
          sql: ""
        }
      ];
      
      // 尝试直接使用用户提供的示例数据
      try {
        const exampleData = [
          {"id":"706a0094-1ca8-58f8-a622-0a2c8d0ff1cf-sql","question":"查询岗位信息表下的所有信息","content":"SELECT * FROM `abc_t_gx_gwxx`;","training_data_type":"sql","answer":"SELECT * FROM `abc_t_gx_gwxx`;","solution":""},
          {"id":"78e390c0-2524-5dd2-a663-66b65855eb3a-ddl","question":null,"content":"xxx表是xx表","training_data_type":"ddl","answer":"xxx表是xx表","solution":""},
          {"id":"a3d2786f-1253-5d8d-9c1d-a555868e42e9-doc","question":null,"content":"岗位信息表 is abc_t_gx_gwxx","training_data_type":"documentation","answer":"岗位信息表 is abc_t_gx_gwxx","solution":""}
        ];
        
        const formattedExampleData = exampleData.map(item => {
          // 处理训练数据类型，确保一致性
          let dataType = (item.training_data_type || "未知").toLowerCase();
          
          // 标准化所有类型，确保一致性
          if (dataType === "doc" || dataType === "文档" || dataType.includes("document") || dataType.includes("文档")) {
            dataType = "documentation";
          } else if (dataType === "sql") {
            dataType = "sql";
          } else if (dataType === "ddl") {
            dataType = "ddl";
          } else if (dataType === "solution" || dataType === "解题步骤") {
            dataType = "solution";
          }
          
          console.log(`示例数据 - 原始类型: ${item.training_data_type}, 标准化类型: ${dataType}`);
          
          return {
            id: item.id,
            action: "delete",
            question: item.question !== null ? item.question : "",
            content: item.content,
            trainingDataType: dataType,
            answer: item.answer || undefined,
            sql: "",
            solution: item.solution || undefined
          };
        });
        
        setTrainingData(formattedExampleData);
        setTotalItems(formattedExampleData.length);
      } catch (exampleError) {
        console.error("使用示例数据失败:", exampleError);
        setTrainingData(mockData);
        setTotalItems(mockData.length);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 添加调试日志，检查数据加载后的类型分布
  useEffect(() => {
    if (!isLoading && trainingData.length > 0) {
      console.log('数据加载完成，检查类型分布:');
      const typeMap: Record<string, number> = {};
      trainingData.forEach(item => {
        const type = item.trainingDataType.toLowerCase();
        typeMap[type] = (typeMap[type] || 0) + 1;
      });
      console.log('类型统计:', typeMap);
      
      // 检查documentation类型的数据
      const docItems = trainingData.filter(item => 
        ["documentation", "doc", "文档"].includes(item.trainingDataType.toLowerCase())
      );
      console.log('Documentation类型数据:', docItems);
    }
  }, [isLoading, trainingData]);
  
  // 过滤数据
  const filteredData = selectedType === "all" 
    ? trainingData
    : trainingData.filter(item => {
        // 获取类型并确保为小写
        const itemType = (item.trainingDataType || "").toLowerCase();
        
        // 添加详细调试日志
        console.log(`筛选项: ${selectedType}, 当前项: ${item.trainingDataType}(${itemType})`);
        
        // 特殊处理文档类型，支持多种可能的值
        if (selectedType === "documentation") {
          // 检查是否为文档类型 - 使用更宽松的匹配
          const isDocType = (
            itemType === "documentation" || 
            itemType === "doc" || 
            itemType === "文档" || 
            itemType.includes("document") || 
            itemType.includes("文档")
          );
          console.log(`文档类型检查: ${itemType} => ${isDocType}`);
          return isDocType;
        }
        
        // 特殊处理解题步骤类型
        if (selectedType === "solution") {
          const isSolutionType = (
            itemType === "solution" || 
            itemType === "解题步骤"
          );
          console.log(`解题步骤类型检查: ${itemType} => ${isSolutionType}`);
          return isSolutionType;
        }
        
        // 其他类型使用精确匹配
        const isMatchingType = itemType === selectedType.toLowerCase();
        console.log(`常规类型检查: ${itemType} === ${selectedType.toLowerCase()} => ${isMatchingType}`);
        return isMatchingType;
      });
      
  // 搜索过滤
  const searchFilteredData = searchTerm.trim() === "" 
    ? filteredData 
    : filteredData.filter(item => {
        const searchLower = searchTerm.toLowerCase();
        
        if (searchField === "question") {
          return item.question.toLowerCase().includes(searchLower);
        } else if (searchField === "content") {
          return item.content.toLowerCase().includes(searchLower);
        } else {
          // 搜索所有字段
          return (
            item.question.toLowerCase().includes(searchLower) ||
            item.content.toLowerCase().includes(searchLower) ||
            (item.answer && item.answer.toLowerCase().includes(searchLower)) ||
            (item.sql && item.sql.toLowerCase().includes(searchLower)) ||
            (item.ddl && item.ddl.toLowerCase().includes(searchLower)) ||
            (item.documentation && item.documentation.toLowerCase().includes(searchLower)) ||
            (item.solution && item.solution.toLowerCase().includes(searchLower))
          );
        }
      });
      
  // 调试输出过滤后的数据
  useEffect(() => {
    if (selectedType !== "all") {
      console.log(`筛选后(${selectedType})数据数量:`, filteredData.length);
      console.log('筛选后数据:', filteredData);
    }
  }, [selectedType, filteredData]);
  
  // 调试输出搜索后的数据
  useEffect(() => {
    if (searchTerm.trim() !== "") {
      console.log(`搜索后(${searchTerm})数据数量:`, searchFilteredData.length);
    }
  }, [searchTerm, searchField, searchFilteredData]);

  // 获取带后缀的ID
  const getSuffixedId = (id: string, type: string) => {
    // 如果ID已经包含后缀，直接返回
    if (id.includes('-sql') || id.includes('-ddl') || id.includes('-doc') || id.includes('-solution')) {
      return id;
    }
    
    // 根据类型添加后缀
    switch (type.toLowerCase()) {
      case 'sql':
        return `${id}-sql`;
      case 'ddl':
        return `${id}-ddl`;
      case 'documentation':
      case 'doc':
      case '文档':
        return `${id}-doc`;
      case 'solution':
      case '解题步骤':
        return `${id}-solution`;
      default:
        return id;
    }
  };

  // 删除训练数据
  const handleDelete = async (id: string, type: string) => {
    const suffixedId = getSuffixedId(id, type);
    console.log(`删除训练数据: ${suffixedId}`);
    try {
      console.log('开始调用 API 删除数据...');
      const result = await apiService.removeTrainingData(suffixedId);
      console.log('API 删除结果:', result);
      loadTrainingData(); // 重新加载数据
    } catch (error) {
      console.error("删除训练数据失败:", error);
      // 模拟删除成功
      setTrainingData(prev => prev.filter(item => item.id !== id));
      setTotalItems(prev => prev - 1);
    }
  };

  // 分类改变处理
  const handleTypeChange = (type: DataType) => {
    setSelectedType(type);
    setCurrentPage(1); // 切换分类时重置为第一页
  };

  // 模态框关闭后重新加载数据
  const handleModalClose = (dataAdded: boolean) => {
    setShowAddModal(false);
    if (dataAdded) {
      loadTrainingData();
    }
  };

  // 导入模态框关闭处理
  const handleImportModalClose = (dataImported: boolean) => {
    setShowImportModal(false);
    if (dataImported) {
      loadTrainingData();
    }
  };

  // 首次加载时获取数据
  useEffect(() => {
    loadTrainingData();
  }, []);
  
  // 处理点击外部区域关闭导出选项
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportButtonRef.current && !exportButtonRef.current.contains(event.target as Node)) {
        setShowExportOptions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // 切换内容展开/收起
  const toggleContentExpand = (id: string) => {
    if (expandedContent === id) {
      setExpandedContent(null);
    } else {
      setExpandedContent(id);
    }
  };
  
  // 切换问题展开/收起
  const toggleQuestionExpand = (id: string) => {
    if (expandedQuestion === id) {
      setExpandedQuestion(null);
    } else {
      setExpandedQuestion(id);
    }
  };
  
  // 切换答案展开/收起
  const toggleAnswerExpand = (id: string) => {
    if (expandedAnswer === id) {
      setExpandedAnswer(null);
    } else {
      setExpandedAnswer(id);
    }
  };
  
  // 导出训练数据
  const handleExportData = async (format: 'json' | 'excel') => {
    try {
      setIsExporting(true);
      setShowExportOptions(false);
      
      // 准备导出数据
      const dataToExport = searchFilteredData.map(item => ({
        id: item.id,
        question: item.question || null,
        content: item.content,
        training_data_type: item.trainingDataType,
        answer: item.answer || null
      }));
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      
      if (format === 'json') {
        // 创建JSON文件
        const jsonContent = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        // 创建下载链接并触发下载
        const link = document.createElement('a');
        link.download = `training-data-${timestamp}.json`;
        link.href = url;
        link.click();
        
        // 清理
        URL.revokeObjectURL(url);
      } else if (format === 'excel') {
        // 为Excel导出准备更友好的数据
        const excelData = searchFilteredData.map((item, index) => ({
          序号: index + 1,
          ID: item.id,
          问题: item.question || "",
          内容: item.content,
          答案: item.answer || "",
          数据类型: item.trainingDataType
        }));
        
        // 创建Excel工作簿
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        
        // 设置列宽
        const columnWidths = [
          { wch: 5 },   // 序号
          { wch: 40 },  // ID
          { wch: 30 },  // 问题
          { wch: 50 },  // 内容
          { wch: 50 },  // 答案
          { wch: 15 },  // 数据类型
        ];
        worksheet['!cols'] = columnWidths;
        
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "训练数据");
        
        // 生成Excel文件并下载
        XLSX.writeFile(workbook, `training-data-${timestamp}.xlsx`);
      }
      
      setTimeout(() => setIsExporting(false), 1000);
    } catch (error) {
      console.error('导出训练数据失败:', error);
      alert('导出失败，请重试');
      setIsExporting(false);
    }
  };
  
  // 显示导出选项
  const toggleExportOptions = () => {
    if (searchFilteredData.length === 0) return;
    setShowExportOptions(!showExportOptions);
  };
  
  // 计算分页
  const totalFilteredItems = searchFilteredData.length;
  const totalPages = Math.ceil(totalFilteredItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalFilteredItems);
  const currentItems = searchFilteredData.slice(startIndex, endIndex);

  // 批量删除训练数据
  const handleBatchDelete = async () => {
    if (selectedItems.length === 0) return;
    setIsDeleting(true);
    try {
      // 为每个选中的ID调用删除API
      for (const id of selectedItems) {
        try {
          // 找到对应的数据项以获取类型
          const item = trainingData.find(item => item.id === id);
          if (item) {
            const suffixedId = getSuffixedId(id, item.trainingDataType);
            await apiService.removeTrainingData(suffixedId);
          }
        } catch (error) {
          console.error(`删除ID为${id}的数据失败:`, error);
        }
      }
      
      // 更新本地数据
      setTrainingData(prev => prev.filter(item => !selectedItems.includes(item.id)));
      setTotalItems(prev => prev - selectedItems.length);
      
      // 清空选中项
      setSelectedItems([]);
      setShowDeleteConfirm(false);
      
      // 可选：重新加载数据确保与服务器同步
      // loadTrainingData();
    } catch (error) {
      console.error("批量删除训练数据失败:", error);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // 处理选择/取消选择单个项目
  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  // 处理全选/取消全选当前页面的项目
  const handleSelectAllOnPage = (isSelected: boolean) => {
    if (isSelected) {
      const currentPageIds = currentItems.map(item => item.id);
      setSelectedItems(prev => {
        // 合并之前已选择的和当前页的所有ID，确保不重复
        const combinedIds = [...prev];
        for (const id of currentPageIds) {
          if (!combinedIds.includes(id)) {
            combinedIds.push(id);
          }
        }
        return combinedIds;
      });
    } else {
      // 仅从已选择项中移除当前页的ID
      const currentPageIds = currentItems.map(item => item.id);
      setSelectedItems(prev => prev.filter(id => !currentPageIds.includes(id)));
    }
  };
  
  // 检查当前页是否全部选中
  const isAllSelectedOnCurrentPage = currentItems.length > 0 && 
    currentItems.every(item => selectedItems.includes(item.id));

  // 处理每页显示数量变化
  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // 重置到第一页
  };

  // 处理搜索输入变化
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // 重置到第一页
  };
  
  // 处理搜索字段变化
  const handleSearchFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSearchField(e.target.value as "question" | "content" | "all");
    setCurrentPage(1); // 重置到第一页
  };
  
  // 清除搜索
  const clearSearch = () => {
    setSearchTerm("");
    setCurrentPage(1); // 重置到第一页
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 导航栏 */}
      <header className="flex items-center p-4 border-b border-gray-200">
        <div className="flex items-center">
          <Link href="/">
            <div className="flex items-center">
              <Image
                src="/vanna-icon.svg"
                alt="红城智能检查助手 Logo"
                width={32}
                height={32}
                className="mr-2"
              />
              <span className="text-xl font-semibold text-blue-500">红城智能检查助手</span>
            </div>
          </Link>
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-64 border-r border-gray-200 flex flex-col">
          <div className="p-4">
            <Link 
              href="/training" 
              prefetch={true}
              className={`flex items-center p-2 rounded cursor-pointer ${!showReviewTab ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
              onClick={() => setShowReviewTab(false)}
            >
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>训练数据管理</span>
            </Link>

            {userRole === 'admin' && (
              <div 
                className={`flex items-center p-2 rounded cursor-pointer mt-2 ${showReviewTab ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
                onClick={() => setShowReviewTab(true)}
              >
                <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>SQL审核</span>
                {pendingReviews.filter(r => r.status === 'pending').length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    {pendingReviews.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </div>
            )}

            <Link 
              href="/"
              className="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer mt-2"
            >
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>返回首页</span>
            </Link>
          </div>
          <div className="mt-auto p-4 border-t border-gray-200">
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm text-green-500">已连接</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700">
                      {userRole === 'admin' ? '管理员' : '普通员工'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {userRole === 'admin' ? 'admin' : '员工用户'}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleLogout}
                className="flex items-center justify-center space-x-2 w-full px-4 py-2 text-sm text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>退出登录</span>
              </button>
            </div>
          </div>
        </aside>

        {/* 主要内容区域 */}
        <main className="flex-1 overflow-y-auto p-6">
          {showReviewTab ? (
            <SqlReviewPanel />
          ) : (
            <div className="container mx-auto">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800">训练数据</h1>
                    <p className="text-gray-600 mt-1">添加或删除训练数据。良好的训练数据是准确性的关键。</p>
                  </div>
                  <div className="flex space-x-4">
                    <Link href="/" className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                      返回首页
                    </Link>
                    <div className="relative" ref={exportButtonRef}>
                      <button
                        onClick={toggleExportOptions}
                        disabled={isExporting || searchFilteredData.length === 0}
                        className={`px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center ${(isExporting || searchFilteredData.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18" />
                        </svg>
                        {isExporting ? '导出中...' : '批量导出'}
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {showExportOptions && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                          <div className="py-1">
                            <button
                              onClick={() => handleExportData('json')}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              导出为JSON
                            </button>
                            <button
                              onClick={() => handleExportData('excel')}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              导出为Excel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      批量导入
                    </button>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
                    >
                      <span className="mr-1">+</span> 添加训练数据
                    </button>
                  </div>
                </div>

                {/* 分类筛选 */}
                <div className="mb-6">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleTypeChange("all")}
                      className={`px-4 py-2 rounded-md ${
                        selectedType === "all" 
                          ? "bg-blue-500 text-white" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      全部
                    </button>
                    <button
                      onClick={() => handleTypeChange("sql")}
                      className={`px-4 py-2 rounded-md ${
                        selectedType === "sql" 
                          ? "bg-blue-500 text-white" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      SQL
                    </button>
                    <button
                      onClick={() => handleTypeChange("ddl")}
                      className={`px-4 py-2 rounded-md ${
                        selectedType === "ddl" 
                          ? "bg-blue-500 text-white" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      DDL
                    </button>
                    <button
                      onClick={() => handleTypeChange("documentation")}
                      className={`px-4 py-2 rounded-md ${
                        selectedType === "documentation" 
                          ? "bg-blue-500 text-white" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      文档
                    </button>
                    <button
                      onClick={() => handleTypeChange("solution")}
                      className={`px-4 py-2 rounded-md ${
                        selectedType === "solution" 
                          ? "bg-blue-500 text-white" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      解题步骤
                    </button>
                  </div>
                </div>

                {/* 搜索框 */}
                <div className="mb-6 flex items-center space-x-2">
                  <div className="relative flex-grow">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      placeholder="搜索训练数据..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {searchTerm && (
                      <button
                        onClick={clearSearch}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <select
                    value={searchField}
                    onChange={handleSearchFieldChange}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">全部字段</option>
                    <option value="question">问题</option>
                    <option value="content">内容</option>
                  </select>
                  <div className="text-sm text-gray-500">
                    {searchTerm && `找到 ${searchFilteredData.length} 条结果`}
                  </div>
                </div>

                {/* 批量操作区域 */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    {selectedItems.length > 0 && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isDeleting}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        {isDeleting ? "删除中..." : `批量删除(${selectedItems.length})`}
                      </button>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    {selectedItems.length > 0
                      ? `已选择 ${selectedItems.length} 项`
                      : "可选择多项进行批量操作"}
                  </div>
                </div>

                {/* 训练数据表格 */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                          <input
                            type="checkbox"
                            checked={isAllSelectedOnCurrentPage}
                            onChange={(e) => handleSelectAllOnPage(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            disabled={currentItems.length === 0}
                          />
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                          操作
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          问题
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-96">
                          内容
                        </th>
                        {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-96">
                          答案
                        </th> */}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                          训练数据类型
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {isLoading ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                            正在加载...
                          </td>
                        </tr>
                      ) : currentItems.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                            暂无训练数据
                          </td>
                        </tr>
                      ) : (
                        currentItems.map((item) => (
                          <tr key={item.id} className={selectedItems.includes(item.id) ? "bg-blue-50" : ""}>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => handleSelectItem(item.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // 阻止事件冒泡
                                  console.log('删除按钮被点击，ID:', item.id);
                                  handleDelete(item.id, item.trainingDataType);
                                }}
                                className="text-red-500 border border-red-300 rounded px-4 py-2 text-sm hover:bg-red-50"
                              >
                                删除
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              <div 
                                className={`${expandedQuestion === item.id ? '' : 'max-w-xs truncate cursor-pointer'}`}
                                onClick={() => toggleQuestionExpand(item.id)}
                                title={expandedQuestion === item.id ? "" : "点击查看完整问题"}
                              >
                                {item.question}
                              </div>
                              {expandedQuestion === item.id && item.question && (
                                <button 
                                  className="text-xs text-blue-500 mt-1 hover:text-blue-700"
                                  onClick={() => setExpandedQuestion(null)}
                                >
                                  收起
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div 
                                className={`${expandedContent === item.id ? '' : 'max-w-xs truncate cursor-pointer'}`}
                                onClick={() => toggleContentExpand(item.id)}
                                title={expandedContent === item.id ? "" : "点击查看完整内容"}
                              >
                                {item.trainingDataType === "sql" ? item.sql : 
                                 item.trainingDataType === "ddl" ? item.ddl :
                                 item.trainingDataType === "documentation" ? item.documentation :
                                 item.trainingDataType === "solution" ? (
                                   typeof item.solution === 'string' && item.solution.trim().startsWith('{') 
                                     ? (() => {
                                         return item.solution || item.content || "";

                                       })()
                                     : item.solution || item.content || ""
                                 ) :
                                 item.content}
                              </div>
                              {expandedContent === item.id && (
                                <button 
                                  className="text-xs text-blue-500 mt-1 hover:text-blue-700"
                                  onClick={() => setExpandedContent(null)}
                                >
                                  收起
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div 
                                className={`${expandedAnswer === item.id ? '' : 'max-w-xs truncate cursor-pointer'}`}
                                onClick={() => toggleAnswerExpand(item.id)}
                                title={expandedAnswer === item.id ? "" : "点击查看完整答案"}
                              >
                                {item.answer || ""}
                              </div>
                              {expandedAnswer === item.id && item.answer && (
                                <button 
                                  className="text-xs text-blue-500 mt-1 hover:text-blue-700"
                                  onClick={() => setExpandedAnswer(null)}
                                >
                                  收起
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {(() => {
                                // 标准化显示类型
                                const displayType = (() => {
                                  const type = item.trainingDataType.toLowerCase();
                                  if (type === "documentation" || type === "doc" || type === "文档" || type.includes("document") || type.includes("文档")) {
                                    return "文档";
                                  } else if (type === "sql") {
                                    return "SQL";
                                  } else if (type === "ddl") {
                                    return "DDL";
                                  } else if (type === "solution") {
                                    return "解题步骤";
                                  } else {
                                    return item.trainingDataType;
                                  }
                                })();
                                
                                return displayType;
                              })()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 分页控制 */}
                {!isLoading && totalPages > 0 && (
                  <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 mt-4">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-700">
                        显示: <span className="font-medium">{startIndex + 1}</span> - <span className="font-medium">{endIndex}</span> 共 <span className="font-medium">{totalFilteredItems}</span> 条
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700">每页显示:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                          className="block w-20 rounded-md border-gray-300 py-1.5 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        >
                          <option value={5}>5条</option>
                          <option value={10}>10条</option>
                          <option value={20}>20条</option>
                          <option value={50}>50条</option>
                          <option value={100}>100条</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        首页
                      </button>
                      <button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        上一页
                      </button>
                      <span className="text-gray-700 px-2">
                        第 {currentPage} 页，共 {totalPages} 页
                      </span>
                      <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一页
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        末页
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 添加训练数据模态框 */}
      {showAddModal && <AddTrainingModal onClose={handleModalClose} />}
      
      {/* 批量导入训练数据模态框 */}
      {showImportModal && <ImportTrainingModal onClose={handleImportModalClose} />}
      
      {/* 批量删除确认模态框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900">确认删除</h3>
            </div>
            <p className="mb-4 text-gray-500">
              您确定要删除选中的 {selectedItems.length} 项训练数据吗？此操作无法撤销。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                disabled={isDeleting}
              >
                取消
              </button>
              <button
                onClick={handleBatchDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}