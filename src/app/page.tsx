"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { apiService, Question, SqlWithVariablesResponse } from "../services/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cookies from 'js-cookie';

// 定义响应类型
interface QueryResponse {
  question: string;
  sql?: string;
  result?: any;
  sessionId?: string;
  explanation?: string;
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
}

// SQL变量相关接口
interface SqlVariable {
  name: string;
  description: string;
  value: string;
}

// 定义对话历史项类型
interface ConversationItem {
  id: string;
  question: string;
  sql?: string;
  result?: any;
  timestamp: string;
  error?: {
    message: string;
    code?: string;
    details?: string;
  };
  isUser: boolean; // 添加标识是否为用户消息
  explanation?: string;
}

interface TableData {
  columns: string[];
  rows: any[];
  total: number;
  currentPage: number;
  pageSize: number;
}

// 最多保存的最近问题数量
const MAX_RECENT_QUESTIONS = 5;

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<"idle" | "generating" | "executing">("idle");
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
  const [currentResponse, setCurrentResponse] = useState<QueryResponse | null>(null);
  const [isEditingSQL, setIsEditingSQL] = useState(false);
  const [editedSQL, setEditedSQL] = useState("");
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [followupQuestions, setFollowupQuestions] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' } | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [questionHistory, setQuestionHistory] = useState<Question[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const [showRecentQuestions, setShowRecentQuestions] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<ConversationItem[]>([]);
  const [userRole, setUserRole] = useState<'admin' | 'employee' | null>(null);
  const router = useRouter();
  
  // SQL变量相关状态
  const [sqlVariables, setSqlVariables] = useState<SqlVariable[]>([]);
  const [showVariableForm, setShowVariableForm] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<string>("");
  const [originalSql, setOriginalSql] = useState<string>("");
  
  const resultRef = useRef<HTMLDivElement>(null);
  const scrollToResults = () => {
    resultRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 检查登录状态
  useEffect(() => {
    const role = Cookies.get('userRole');
    if (!role) {
      router.push('/login');
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

  // 添加最近的问题到历史记录
  const addToRecentQuestions = (question: string) => {
    setRecentQuestions(prev => {
      // 如果问题已存在，先移除它
      const filtered = prev.filter(q => q !== question);
      // 添加到数组开头
      const updated = [question, ...filtered];
      // 只保留最多MAX_RECENT_QUESTIONS个问题
      return updated.slice(0, MAX_RECENT_QUESTIONS);
    });
  };

  // 从最近问题中选择
  const selectRecentQuestion = (question: string) => {
    setInputValue(question);
    setShowRecentQuestions(false);
  };

  // 处理复制成功提示
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  // 处理表格排序
  const handleSort = (column: string) => {
    setSortConfig(current => ({
      column,
      direction: current?.column === column && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // 处理SQL编辑
  const handleEditSQL = () => {
    setIsEditingSQL(true);
    setEditedSQL(currentResponse?.sql || "");
  };

  // 应用SQL编辑
  const handleApplySQL = async () => {
    if (!editedSQL.trim()) return;
    
    setIsLoading(true);
    setLoadingState("executing");
    try {
      const resultResponse = await apiService.runSql(currentResponse?.sessionId || "");
      setCurrentResponse(prev => ({
        ...prev!,
        sql: editedSQL,
        result: resultResponse.df
      }));
      processQueryResult(resultResponse.df);
    } catch (error: any) {
      setCurrentResponse(prev => ({
        ...prev!,
        error: {
          message: "SQL执行失败",
          details: error?.message || "未知错误",
          code: error?.code
        }
      }));
    } finally {
      setIsLoading(false);
      setLoadingState("idle");
      setIsEditingSQL(false);
    }
  };

  // 处理数据下载
  const handleDownload = async () => {
    if (!currentResponse?.sessionId) return;
    try {
      await apiService.downloadCsv(currentResponse.sessionId);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  // 获取问题历史
  const fetchQuestionHistory = async () => {
    try {
      const response = await apiService.getQuestionHistory();
      if (response && response.questions) {
        setQuestionHistory(response.questions);
      }
    } catch (error) {
      console.error('获取问题历史失败:', error);
      // 设置一些模拟数据用于测试
      setQuestionHistory([
        { id: '1', question: '查询最近一个月的销售数据', timestamp: '2023-10-15T08:30:00Z' },
        { id: '2', question: '统计各区域客户数量', timestamp: '2023-10-14T14:25:00Z' },
        { id: '3', question: '查找销售额最高的产品', timestamp: '2023-10-13T11:45:00Z' }
      ]);
    }
  };

  // 加载历史问题
  const handleLoadQuestion = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await apiService.loadQuestion(id);
      if (response) {
        setCurrentResponse({
          question: response.question,
          sql: response.sql,
          result: response.df ? JSON.parse(response.df) : null,
          sessionId: response.id
        });
        
        if (response.df) {
          processQueryResult(JSON.parse(response.df));
        }
        
        if (response.followup_questions && response.followup_questions.length > 0) {
          setFollowupQuestions(response.followup_questions);
        }
        
        scrollToResults();
      }
    } catch (error) {
      console.error('加载问题失败:', error);
    } finally {
      setIsLoading(false);
      setShowHistory(false);
    }
  };

  // 修改保存训练数据的处理函数
  const handleSaveTraining = async () => {
    if (!currentResponse?.question || !currentResponse?.sql) return;
    
    setIsSaving(true);
    try {
      // 提交审核请求而不是直接保存
      await apiService.submitSqlForReview({
        question: currentResponse.question,
        sql: currentResponse.sql,
        result: currentResponse.result,
        explanation: currentResponse.explanation
      });
      setShowSavePrompt(false);
      // 显示成功提示
      alert("已提交审核，等待管理员审核通过后将保存为训练数据");
    } catch (error) {
      console.error('提交审核失败:', error);
      alert("提交失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  // 处理SQL变量输入变化
  const handleVariableChange = (index: number, value: string) => {
    const updatedVariables = [...sqlVariables];
    updatedVariables[index].value = value;
    setSqlVariables(updatedVariables);
  };

  // 执行带变量的SQL查询
  const handleRunWithVariables = async () => {
    if (sqlVariables.length === 0 || !currentQueryId) return;
    
    // 准备变量值对象
    const variableValues: Record<string, string> = {};
    sqlVariables.forEach(variable => {
      variableValues[variable.name] = variable.value;
    });
    
    setIsLoading(true);
    setLoadingState("executing");
    
    try {
      // 应用变量到SQL
      const appliedResponse = await apiService.applyVariables(currentQueryId, variableValues);
      
      // 执行替换变量后的SQL
      const resultResponse = await apiService.runSqlWithVariables(currentQueryId);
      console.log('resultResponse',resultResponse);
      
      // 打印从后端获得的explanation内容
      console.log('带变量SQL执行后获得的explanation:', resultResponse.explanation);
      
      // 更新响应中的SQL和结果
      setCurrentResponse(prev => ({
        ...prev!,
        sql: appliedResponse.final_sql,
        result: resultResponse.df,
        explanation: resultResponse.explanation || prev?.explanation
      }));

      // 处理查询结果
      if (resultResponse.df) {
        processQueryResult(resultResponse.df);
      }
      
      // 隐藏变量表单
      setShowVariableForm(false);
      
      // 更新对话历史
      setConversationHistory(prev => {
        const lastIndex = prev.length - 1;
        const updatedHistory = [...prev];
        if (lastIndex >= 0) {
          updatedHistory[lastIndex] = {
            ...updatedHistory[lastIndex],
            sql: appliedResponse.final_sql,
            result: resultResponse.df,
            explanation: resultResponse.explanation || updatedHistory[lastIndex].explanation
          };
        }
        return updatedHistory;
      });
      
      setIsLoading(false);
      setLoadingState("idle");
      
      // 滚动到结果区域
      scrollToResults();
    } catch (error: any) {
      // 自动尝试重试
      try {
        const retryResponse = await apiService.retrySql(
          currentQueryId,
          currentResponse?.sql || "",
          {
            message: error?.message || "SQL执行失败",
            code: error?.code,
            details: error?.details
          }
        );
        
        if (retryResponse.execution_status === 'success') {
          // 更新当前响应
          setCurrentResponse(prev => ({
            ...prev!,
            sql: retryResponse.corrected_sql,
            result: JSON.parse(retryResponse.df),
            error: undefined,
            explanation: retryResponse.explanation
          }));
          
          // 处理查询结果
          processQueryResult(retryResponse.df);
          
          // 更新对话历史
          setConversationHistory(prev => {
            const lastIndex = prev.length - 1;
            const updatedHistory = [...prev];
            if (lastIndex >= 0) {
              updatedHistory[lastIndex] = {
                ...updatedHistory[lastIndex],
                sql: retryResponse.corrected_sql,
                result: JSON.parse(retryResponse.df),
                error: undefined,
                explanation: retryResponse.explanation
              };
            }
            return updatedHistory;
          });
        } else {
          throw new Error(retryResponse.error_info?.message || "重试执行失败");
        }
      } catch (retryError: any) {
        setCurrentResponse(prev => ({
          ...prev!,
          error: {
            message: retryError?.message || "执行查询失败",
            details: retryError?.details || "未知错误",
            code: retryError?.code
          }
        }));
      }
      setIsLoading(false);
      setLoadingState("idle");
    }
  };

  // 修改handleSubmit函数，添加自动重试机制
  const handleSubmit = async () => {
    if (!inputValue.trim()) {
      alert("请输入问题");
      return;
    }

    // 保存当前问题，便于后续使用
    const currentQuestion = inputValue;
    
    // 添加到最近问题列表
    addToRecentQuestions(currentQuestion);
    
    // 清空输入框，让用户可以继续输入下一个问题
    setInputValue("");
    
    // 重置SQL变量相关状态
    setSqlVariables([]);
    setShowVariableForm(false);
    
    // 添加用户问题到对话历史
    const userMessage: ConversationItem = {
      id: Date.now().toString(),
      question: currentQuestion,
      timestamp: new Date().toISOString(),
      isUser: true
    };
    
    setConversationHistory(prev => [...prev, userMessage]);
    
    setIsLoading(true);
    setLoadingState("generating");
    try {
      // 准备完整的对话历史上下文
      const conversationContext = conversationHistory
        .map(item => ({
          question: item.question,
          sql: item.sql,
          result: item.result,
          isUser: item.isUser,
          timestamp: item.timestamp
        }));
      
      // 生成SQL
      const generatedSql = await apiService.generateSql(currentQuestion, conversationContext);
      
      // 打印从后端获得的explanation内容
      console.log('从后端获得的explanation:', generatedSql.explanation);
      
      // 检查SQL中是否包含变量（以:开头的标识符）
      const variableMatches = generatedSql.text.match(/:[a-zA-Z0-9_\u4e00-\u9fa5]+/g) || [];
      
      if (variableMatches.length > 0 || (generatedSql.type === "sql_with_variables" && "variables" in generatedSql)) {
        const sqlWithVars = generatedSql.type === "sql_with_variables" ? 
          generatedSql : 
          {
            id: generatedSql.id,
            text: generatedSql.text,
            type: "sql_with_variables" as const,
            variables: Object.fromEntries(
              variableMatches.map(v => [v.substring(1), `请输入${v.substring(1)}的值`])
            )
          };
        
        // 保存查询ID和原始SQL
        setCurrentQueryId(sqlWithVars.id);
        setOriginalSql(sqlWithVars.text);
        
        // 准备变量列表
        const variableEntries = sqlWithVars.type === "sql_with_variables" && "variables" in sqlWithVars
          ? Object.entries(sqlWithVars.variables as Record<string, string>)
          : variableMatches.map(v => [v.substring(1), `请输入${v.substring(1)}的值`]);
        
        const variables: SqlVariable[] = variableEntries.map(([name, description]) => ({
          name,
          description: String(description),
          value: ""
        }));
        
        setSqlVariables(variables);
        setShowVariableForm(true);
        
        // 设置临时响应
        const systemResponse: ConversationItem = {
          id: sqlWithVars.id,
          question: currentQuestion,
          sql: sqlWithVars.text,
          timestamp: new Date().toISOString(),
          isUser: false,
          explanation: generatedSql.explanation
        };
        
        setConversationHistory(prev => [...prev, systemResponse]);
        setCurrentResponse({
          question: currentQuestion,
          sql: sqlWithVars.text,
          sessionId: sqlWithVars.id,
          explanation: generatedSql.explanation
        });
        
        setIsLoading(false);
        setLoadingState("idle");
        return;
      }
      
      setLoadingState("executing");
      // 执行SQL
      try {
        const resultResponse = await apiService.runSql(generatedSql.id);
        console.log('resultResponse111',resultResponse);
        // 检查执行状态
        if (resultResponse.execution_status === 'failed' || resultResponse.execution_status === 'error' || resultResponse.error) {
          // 如果执行失败，尝试重试
          const retryResponse = await apiService.retrySql(
            generatedSql.id,
            generatedSql.text,
            {
              message: resultResponse.error_info?.message || "SQL执行失败",
              code: "SQL_EXECUTION_ERROR",
              details: `执行状态: ${resultResponse.execution_status || 'unknown'}, 原始错误: ${JSON.stringify(resultResponse)}`
            }
          );
          
          if (retryResponse.execution_status === 'success') {
            // 更新当前响应
            setCurrentResponse({
              question: currentQuestion,
              sql: retryResponse.corrected_sql,
              result: JSON.parse(retryResponse.df),
              sessionId: retryResponse.id
            });
            
            // 处理查询结果
            processQueryResult(retryResponse.df);
            
            // 更新对话历史
            const systemResponse: ConversationItem = {
              id: retryResponse.id,
              question: currentQuestion,
              sql: retryResponse.corrected_sql,
              result: JSON.parse(retryResponse.df),
              timestamp: new Date().toISOString(),
              isUser: false,
              explanation: retryResponse.explanation
            };
            
            setConversationHistory(prev => [...prev, systemResponse]);
          } else {
            throw new Error(retryResponse.error_info?.message || "重试执行失败");
          }
        } else {
          // 如果执行成功，直接处理结果
          const response = {
            question: currentQuestion,
            sql: generatedSql.text,
            result: resultResponse.df,
            sessionId: generatedSql.id,
            explanation: generatedSql.explanation
          };
          
          setCurrentResponse(response);
          processQueryResult(resultResponse.df);
          
          // 添加系统回复到对话历史
          const systemResponse: ConversationItem = {
            id: generatedSql.id,
            question: currentQuestion,
            sql: generatedSql.text,
            result: resultResponse.df,
            timestamp: new Date().toISOString(),
            isUser: false,
            explanation: generatedSql.explanation
          };
          console.log('systemResponse',systemResponse.explanation);
          
          setConversationHistory(prev => [...prev, systemResponse]);
          
          // 显示保存提示
          setShowSavePrompt(true);
        }

        // 获取后续问题
        try {
          const followupResponse = await apiService.generateFollowupQuestions(generatedSql.id);
          setFollowupQuestions(followupResponse.questions);
        } catch (error) {
          console.error('获取后续问题失败:', error);
        }

        // 刷新问题历史
        fetchQuestionHistory();
        
        scrollToResults();
      } catch (sqlError: any) {
        // 自动尝试重试
        try {
          const retryResponse = await apiService.retrySql(
            generatedSql.id,
            generatedSql.text,
            {
              message: sqlError?.message || "SQL执行失败",
              code: sqlError?.code,
              details: sqlError?.details
            }
          );
          
          if (retryResponse.execution_status === 'success') {
            // 更新当前响应
            setCurrentResponse({
              question: currentQuestion,
              sql: retryResponse.corrected_sql,
              result: JSON.parse(retryResponse.df),
              sessionId: retryResponse.id
            });
            
            // 处理查询结果
            processQueryResult(retryResponse.df);
            
            // 更新对话历史
            const systemResponse: ConversationItem = {
              id: retryResponse.id,
              question: currentQuestion,
              sql: retryResponse.corrected_sql,
              result: JSON.parse(retryResponse.df),
              timestamp: new Date().toISOString(),
              isUser: false,
              explanation: retryResponse.explanation
            };
            
            setConversationHistory(prev => [...prev, systemResponse]);
          } else {
            throw new Error(retryResponse.error_info?.message || "重试执行失败");
          }
        } catch (retryError: any) {
          const errorResponse: ConversationItem = {
            id: Date.now().toString(),
            question: currentQuestion,
            timestamp: new Date().toISOString(),
            error: {
              message: retryError?.message || "重试执行失败",
              details: retryError?.details || "未知错误",
              code: retryError?.code
            },
            isUser: false
          };
          
          setConversationHistory(prev => [...prev, errorResponse]);
          setCurrentResponse({
            question: currentQuestion,
            error: {
              message: retryError?.message || "重试执行失败",
              details: retryError?.details || "未知错误",
              code: retryError?.code
            }
          });
        }
      }
    } catch (error: any) {
      // 处理其他错误
      const errorResponse: ConversationItem = {
        id: Date.now().toString(),
        question: currentQuestion,
        timestamp: new Date().toISOString(),
        error: {
          message: error?.message || "查询执行失败",
          details: error?.details || "未知错误",
          code: error?.code
        },
        isUser: false
      };
      
      setConversationHistory(prev => [...prev, errorResponse]);
      setCurrentResponse({
        question: currentQuestion,
        error: {
          message: error?.message || "查询执行失败",
          details: error?.details || "未知错误",
          code: error?.code
        }
      });
    } finally {
      setIsLoading(false);
      setLoadingState("idle");
    }
  };

  // 处理查询结果处理
  const processQueryResult = (data: any) => {
    if (!data) {
      console.error('数据为空');
      setTableData(null);
      return;
    }

    try {
      // 如果数据是字符串，尝试解析JSON
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (!Array.isArray(parsedData)) {
        console.error('数据不是数组格式:', parsedData);
        setTableData(null);
        return;
      }

      // 如果数组为空，创建一个只有列名的表格
      if (parsedData.length === 0) {
        setTableData({
          columns: [],
          rows: [],
          total: 0,
          currentPage: 1,
          pageSize: 10
        });
        return;
      }

      // 获取所有列名
      const columns = Object.keys(parsedData[0] || {});
      
      // 处理数据中的null值，将其转换为'-'
      const processedRows = parsedData.map(row => {
        const processedRow: Record<string, any> = {};
        columns.forEach(col => {
          processedRow[col] = row[col] === null ? '-' : row[col];
        });
        return processedRow;
      });

      setTableData({
        columns,
        rows: processedRows,
        total: processedRows.length,
        currentPage: 1,
        pageSize: 10
      });
    } catch (error) {
      console.error('处理查询结果时出错:', error);
      setTableData(null);
      
      // 更新错误状态
      setCurrentResponse(prev => ({
        ...prev!,
        error: {
          message: "处理查询结果失败",
          details: error instanceof Error ? error.message : "数据格式错误",
          code: "PROCESS_ERROR"
        }
      }));
    }
  };

  // 加载示例问题和问题历史
  useEffect(() => {
    const loadExampleQuestions = async () => {
      try {
        const response = await apiService.generateQuestions();
        setExampleQuestions(response.questions);
      } catch (error) {
        console.error("加载示例问题失败:", error);
        // 设置默认的示例问题
        setExampleQuestions([
          "查询销售额最高的前5个产品",
          "统计各部门的平均工资",
          "查找最近一个月的订单数据"
        ]);
      }
    };
    
    loadExampleQuestions();
    fetchQuestionHistory();
  }, []);

  // 处理示例问题点击
  const handleExampleClick = (question: string) => {
    setInputValue(question);
  };

  // 清除当前响应
  const handleClear = () => {
    setCurrentResponse(null);
    setInputValue("");
  };

  // 开始新的对话
  const handleNewConversation = () => {
    setCurrentResponse(null);
    setInputValue("");
    setFollowupQuestions([]);
    setShowSavePrompt(false);
    setShowHistory(false);
    setConversationHistory([]); // 清空对话历史
    // 聚焦到输入框
    setTimeout(() => {
      const inputElement = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
    }, 100);
  };

  // 格式化时间戳
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 添加重试SQL的处理函数
  const handleRetrySQL = async () => {
    if (!currentResponse?.error || !currentResponse?.sql || !currentResponse?.sessionId) return;
    
    setIsLoading(true);
    setLoadingState("executing");
    
    try {
      const retryResponse = await apiService.retrySql(
        currentResponse.sessionId,
        currentResponse.sql,
        {
          message: currentResponse.error.message,
          code: currentResponse.error.code,
          details: currentResponse.error.details
        }
      );
      
      // 打印从后端获得的explanation内容
      console.log('重试SQL后获得的explanation:', retryResponse.explanation);
      
      if (retryResponse.execution_status === 'success') {
        // 更新当前响应
        setCurrentResponse(prev => ({
          ...prev!,
          sql: retryResponse.corrected_sql,
          result: JSON.parse(retryResponse.df),
          error: undefined,
          explanation: retryResponse.explanation
        }));
        
        // 处理查询结果
        processQueryResult(retryResponse.df);
        
        // 更新对话历史
        setConversationHistory(prev => {
          const lastIndex = prev.length - 1;
          const updatedHistory = [...prev];
          if (lastIndex >= 0) {
            updatedHistory[lastIndex] = {
              ...updatedHistory[lastIndex],
              sql: retryResponse.corrected_sql,
              result: JSON.parse(retryResponse.df),
              error: undefined,
              explanation: retryResponse.explanation
            };
          }
          return updatedHistory;
        });
      } else {
        // 更新错误信息
        setCurrentResponse(prev => ({
          ...prev!,
          sql: retryResponse.corrected_sql,
          error: {
            message: retryResponse.error_info?.message || "重试执行失败",
            code: retryResponse.error_info?.code,
            details: `原始SQL: ${retryResponse.original_sql}\n修正后SQL: ${retryResponse.corrected_sql}`
          }
        }));
      }
    } catch (error: any) {
      setCurrentResponse(prev => ({
        ...prev!,
        error: {
          message: "重试请求失败",
          details: error?.message || "未知错误"
        }
      }));
    } finally {
      setIsLoading(false);
      setLoadingState("idle");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* 导航栏 */}
      <header className="flex items-center p-4 border-b border-gray-200">
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
      </header>

      {/* 主内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <aside className="w-64 border-r border-gray-200 flex flex-col">
          <div className="p-4">
            {userRole === 'admin' && (
              <Link 
                href="/training" 
                prefetch={true}
                className="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer"
              >
                <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>训练数据管理</span>
              </Link>
            )}
            <div 
              className="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer mt-2"
              onClick={() => { setShowHistory(!showHistory); fetchQuestionHistory(); }}
            >
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>历史记录</span>
            </div>
            <div 
              className="flex items-center p-2 rounded hover:bg-gray-100 cursor-pointer mt-2"
              onClick={handleNewConversation}
            >
              <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>新建对话</span>
            </div>
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

        {/* 聊天区域 */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {showHistory && (
            <div className="p-4 bg-gray-50 border-b">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-medium text-gray-700">历史问题</h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="text-gray-500 hover:text-gray-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {questionHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">暂无历史问题</p>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {questionHistory.map(q => (
                      <li key={q.id} className="py-3">
                        <div 
                          className="flex items-start p-2 hover:bg-gray-100 rounded cursor-pointer"
                          onClick={() => handleLoadQuestion(q.id)}
                        >
                          <div className="flex-1">
                            <p className="text-gray-700">{q.question}</p>
                            {q.timestamp && (
                              <p className="text-xs text-gray-500 mt-1">{formatTimestamp(q.timestamp)}</p>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              {/* 显示对话历史 */}
              {conversationHistory.length > 0 && (
                <div className="mb-8 space-y-6">
                  {conversationHistory.map((item, index) => (
                    <div key={item.id} className={`rounded-lg p-4 ${item.isUser ? 'bg-blue-50 ml-12' : 'bg-gray-50 mr-12'}`}>
                      <div className="mb-3">
                        <h3 className="font-medium text-gray-700">{item.isUser ? '您的问题' : '系统回复'}</h3>
                        <p className="mt-1">{item.question}</p>
                      </div>
                      
                      {item.sql && (
                        <div className="mb-3">
                          <h3 className="font-medium text-gray-700">SQL查询</h3>
                          <pre className="mt-1 p-2 bg-gray-100 rounded overflow-x-auto text-sm">
                            {item.sql}
                          </pre>
                          {item.explanation && (
                            <div className="mt-2 p-2 bg-blue-50 rounded">
                              <h4 className="font-medium text-blue-700">SQL解释</h4>
                              <p className="mt-1 text-blue-600 text-sm">{item.explanation}</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {item.error && (
                        <div className="bg-red-50 p-3 rounded-lg mt-3">
                          <h3 className="font-medium text-red-700">错误</h3>
                          <p className="mt-1 text-red-600">{item.error.message}</p>
                          {item.error.details && (
                            <p className="mt-1 text-sm text-red-500">{item.error.details}</p>
                          )}
                        </div>
                      )}
                      
                      {index < conversationHistory.length - 1 && (
                        <div className="border-b border-gray-200 mt-4"></div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {!currentResponse && !isLoading && conversationHistory.length === 0 && (
                <>
                  <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-800">欢迎使用红城智能检查助手</h1>
                    <p className="text-lg text-gray-600 mt-2">您的智能SQL查询助手</p>
                  </div>

                  <div className="flex items-start mb-12">
                    <div className="flex-shrink-0 mr-4">
                      <Image
                        src="/vanna-icon.svg"
                        alt="红城智能检查助手"
                        width={48}
                        height={48}
                        className="rounded"
                      />
                    </div>
                    <div>
                      <p className="text-gray-700 mb-2">您可以这样提问：</p>
                      <div className="flex flex-wrap gap-2">
                        {exampleQuestions.map((question, index) => (
                          <div
                            key={index}
                            onClick={() => handleExampleClick(question)}
                            className="inline-block border border-blue-300 text-blue-700 px-4 py-2 rounded-full text-sm hover:bg-blue-50 cursor-pointer"
                          >
                            {question}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {isLoading && (
                <div className="flex items-center justify-center p-8">
                  <div className="bg-white rounded-lg shadow-sm p-6 flex items-center space-x-4">
                    <svg className="w-8 h-8 animate-spin text-blue-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <span className="text-lg text-gray-700">
                      {loadingState === "generating" && "正在生成SQL..."}
                      {loadingState === "executing" && "正在执行查询..."}
                    </span>
                  </div>
                </div>
              )}

              {/* SQL变量输入表单 */}
              {showVariableForm && sqlVariables.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                  <h3 className="text-lg font-medium text-gray-800 mb-4">请输入SQL查询中的变量值</h3>
                  <p className="text-gray-600 mb-4">此SQL查询包含变量，请为以下变量提供值：</p>
                  
                  <div className="space-y-4 mb-6">
                    {sqlVariables.map((variable, index) => (
                      <div key={index} className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1">
                          {variable.name} <span className="text-gray-500">({variable.description})</span>
                        </label>
                        <input
                          type="text"
                          value={variable.value}
                          onChange={(e) => handleVariableChange(index, e.target.value)}
                          placeholder={`请输入 ${variable.name} 的值`}
                          className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowVariableForm(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleRunWithVariables}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      应用变量
                    </button>
                  </div>
                </div>
              )}

              {currentResponse && (
                <div className="space-y-4" ref={resultRef}>
                  {/* 修改保存训练数据提示 */}
                  {showSavePrompt && (
                    <div className="bg-blue-50 p-4 rounded-lg mb-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-medium text-blue-700">提交审核</h3>
                          <p className="text-blue-600 text-sm mt-1">是否将此次查询提交审核？通过审核后将保存为训练数据，这将帮助系统提供更好的查询建议。</p>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setShowSavePrompt(false)}
                            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                          >
                            取消
                          </button>
                          <button
                            onClick={handleSaveTraining}
                            disabled={isSaving}
                            className={`px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 ${
                              isSaving ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                            {isSaving ? '提交中...' : '提交审核'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 查询结果表格 */}
                  {tableData && (
                    <div className="bg-white border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 border-b">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium text-gray-700">查询结果</h3>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500">
                              共 {tableData.total} 条记录，显示 {((tableData.currentPage - 1) * tableData.pageSize) + 1}-
                              {Math.min(tableData.currentPage * tableData.pageSize, tableData.total)} 条
                            </span>
                            <button
                              onClick={handleDownload}
                              className="text-blue-500 hover:text-blue-600 text-sm flex items-center"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              下载CSV
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* {currentResponse?.explanation && (
                        <div className="px-4 py-2 bg-blue-50 border-b">
                          <h4 className="font-medium text-blue-700">SQL解释</h4>
                          <p className="mt-1 text-blue-600 text-sm">{currentResponse.explanation}</p>
                        </div>
                      )} */}
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              {tableData.columns.map((column) => (
                                <th
                                  key={column}
                                  onClick={() => handleSort(column)}
                                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                >
                                  <div className="flex items-center">
                                    {column}
                                    {sortConfig?.column === column && (
                                      <svg className={`w-4 h-4 ml-1 ${sortConfig.direction === 'desc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                      </svg>
                                    )}
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {tableData.rows.slice(
                              (tableData.currentPage - 1) * tableData.pageSize,
                              tableData.currentPage * tableData.pageSize
                            ).map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {tableData.columns.map((column) => (
                                  <td key={column} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {row[column]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {tableData.total > tableData.pageSize && (
                        <div className="px-4 py-3 border-t">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => setTableData(prev => ({ ...prev!, currentPage: prev!.currentPage - 1 }))}
                              disabled={tableData.currentPage === 1}
                              className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50"
                            >
                              上一页
                            </button>
                            <span className="text-sm text-gray-500">
                              第 {tableData.currentPage} 页，共 {Math.ceil(tableData.total / tableData.pageSize)} 页
                            </span>
                            <button
                              onClick={() => setTableData(prev => ({ ...prev!, currentPage: prev!.currentPage + 1 }))}
                              disabled={tableData.currentPage * tableData.pageSize >= tableData.total}
                              className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50"
                            >
                              下一页
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 错误显示 */}
                  {currentResponse?.error && (
                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-red-700">错误</h3>
                          <p className="mt-1 text-red-600">{currentResponse.error.message}</p>
                          {currentResponse.error.details && (
                            <p className="mt-2 text-sm text-red-500 whitespace-pre-wrap">{currentResponse.error.details}</p>
                          )}
                          {currentResponse.error.code && (
                            <p className="mt-1 text-sm text-red-400">错误代码: {currentResponse.error.code}</p>
                          )}
                        </div>
                        <button
                          onClick={handleRetrySQL}
                          disabled={isLoading}
                          className={`px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                            isLoading ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          {isLoading ? '重试中...' : '重试查询'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 后续问题推荐 */}
                  {followupQuestions.length > 0 && (
                    <div className="mt-8">
                      <h3 className="font-medium text-gray-700 mb-3">您可能还想问：</h3>
                      <div className="relative">
                        <div className="flex space-x-2 overflow-x-auto pb-2">
                          {followupQuestions.map((question, index) => (
                            <div
                              key={index}
                              onClick={() => {
                                setInputValue(question);
                                handleSubmit();
                              }}
                              className="flex-shrink-0 px-4 py-2 bg-white border rounded-lg shadow-sm hover:shadow-md cursor-pointer transition-shadow"
                            >
                              <p className="text-sm text-gray-600">{question}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 输入区域 */}
          <div className="border-t border-gray-200 p-4">
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="请输入您的问题，我可以帮您转换为SQL查询"
                  className="w-full p-4 pr-12 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSubmit()}
                  disabled={isLoading}
                  onFocus={() => recentQuestions.length > 0 && setShowRecentQuestions(true)}
                  onBlur={() => setTimeout(() => setShowRecentQuestions(false), 200)}
                />
                {showRecentQuestions && recentQuestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <ul className="py-1">
                      {recentQuestions.map((q, index) => (
                        <li 
                          key={index}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-gray-700 text-sm truncate"
                          onClick={() => selectRecentQuestion(q)}
                        >
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 text-white bg-blue-500 p-2 rounded-md hover:bg-blue-600 ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isLoading ? (
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
