import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { insertTaskSchema, InsertTask, Task, User, Contact } from "@shared/schema";

// Extend the task schema with date validation and field validations
const taskFormSchema = insertTaskSchema.extend({
  dueDate: z.date().optional(),
  relatedId: z.number({
    required_error: "Lead selection is required",
    invalid_type_error: "Please select a valid lead",
  }),
  assignedTo: z.number().optional(),
  contactPersonId: z.number().optional(),
  mobileNumber: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

// Props for the form
interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Task;
  leadId?: number;
  relatedTo?: string;
}

export function TaskForm({ open, onOpenChange, initialData, leadId, relatedTo = "lead" }: TaskFormProps) {
  const { toast } = useToast();
  // State to store selected contact's mobile number
  const [selectedContactMobile, setSelectedContactMobile] = useState<string | null>(null);

  // If leadId is provided, fetch the lead information
  const { data: leadData } = useQuery({
    queryKey: ['/api/leads', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      const res = await apiRequest("GET", `/api/leads/${leadId}`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    },
    enabled: !!leadId,
  });

  // Fetch all leads for the dropdown
  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ['/api/leads'],
  });
  
  // Fetch all users (sales team) for the Assign To dropdown
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });
  
  // Fetch all contacts for the Contact Person dropdown
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

  // Form setup
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "pending",
      relatedTo: "lead",
      relatedId: undefined,
      assignedTo: undefined,
      dueDate: undefined,
    },
  });

  // Update form when leadId changes or when initialData changes
  useEffect(() => {
    console.log("Task form - leadId:", leadId, "initialData:", initialData);

    if (initialData) {
      console.log("Setting form values from initialData:", initialData);
      
      // Reset form with initial values when initialData changes
      form.reset({
        title: initialData.title || "",
        description: initialData.description || "",
        priority: initialData.priority || "medium",
        status: initialData.status || "pending",
        relatedTo: initialData.relatedTo || "lead",
        relatedId: initialData.relatedId,
        assignedTo: initialData.assignedTo,
        contactPersonId: initialData.contactPersonId,
        mobileNumber: initialData.mobileNumber || "",
        dueDate: initialData.dueDate ? new Date(initialData.dueDate) : undefined,
      });

      // If we have a contact person ID, find their mobile number
      if (initialData.contactPersonId && contacts.length > 0) {
        const selectedContact = contacts.find(contact => contact.id === initialData.contactPersonId);
        if (selectedContact) {
          setSelectedContactMobile(selectedContact.phone || null);
        }
      }
    } else if (leadId) {
      // If no initialData but leadId is provided (creating a new task for a lead)
      form.reset({
        title: "",
        description: "",
        priority: "medium",
        status: "pending",
        relatedTo: relatedTo || "lead",
        relatedId: leadId,
        assignedTo: undefined,
        contactPersonId: undefined,
        mobileNumber: "",
        dueDate: undefined,
      });
    }
  }, [leadId, initialData, form, leads, contacts]);
  
  // Update mobile number when contact person changes
  useEffect(() => {
    const contactPersonId = form.watch("contactPersonId");
    if (contactPersonId && contacts.length > 0) {
      const selectedContact = contacts.find(contact => contact.id === contactPersonId);
      if (selectedContact) {
        setSelectedContactMobile(selectedContact.phone || null);
        form.setValue("mobileNumber", selectedContact.phone || "");
      }
    }
  }, [form.watch("contactPersonId"), contacts, form]);

  // Handle form submission
  const createTask = useMutation({
    mutationFn: async (data: InsertTask) => {
      const res = await apiRequest("POST", "/api/tasks", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create task");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      if (leadId) {
        queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/tasks`] });
      }
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });

  const updateTask = useMutation({
    mutationFn: async (data: Partial<Task> & { id: number }) => {
      const { id, ...rest } = data;
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, rest);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update task");
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      if (initialData?.relatedId) {
        queryClient.invalidateQueries({ queryKey: [`/api/${initialData.relatedTo}s/${initialData.relatedId}/tasks`] });
      }
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = async (data: TaskFormValues) => {
    console.log("Task form - submitting data:", data);
    
    // Extra validation
    if (!data.title) {
      console.error("Task form - Title is required");
      toast({
        title: "Validation Error",
        description: "Task title is required",
        variant: "destructive",
      });
      return;
    }
    
    if (!data.relatedId) {
      console.error("Task form - Lead selection is required");
      toast({
        title: "Validation Error",
        description: "Please select a lead for this task",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Get the current user from the API to set as createdBy (only needed for new tasks)
      let userId = initialData?.createdBy;
      
      if (!initialData?.id) {
        const userRes = await apiRequest("GET", "/api/user");
        if (!userRes.ok) {
          throw new Error("Failed to get current user");
        }
        const user = await userRes.json();
        userId = user.id;
      }
      
      // Format the due date if it exists
      const formattedDueDate = data.dueDate ? new Date(data.dueDate).toISOString() : null;
      
      // Create the payload with all required fields
      const payload = {
        title: data.title,
        description: data.description || "",
        priority: data.priority || "medium",
        status: data.status || "pending",
        relatedTo: data.relatedTo || "lead",
        relatedId: data.relatedId,
        assignedTo: data.assignedTo || null,
        contactPersonId: data.contactPersonId || null,
        mobileNumber: data.mobileNumber || null,
        dueDate: formattedDueDate,
        createdBy: userId
      };
      
      console.log("Task form - final payload:", payload);

      if (initialData?.id) {
        console.log("Task form - updating existing task with ID:", initialData.id);
        updateTask.mutate({ 
          id: initialData.id, 
          ...payload 
        });
      } else {
        console.log("Task form - creating new task");
        createTask.mutate(payload as InsertTask);
      }
    } catch (error) {
      console.error("Task form - submission error:", error);
      toast({
        title: "Error",
        description: "Failed to submit task: " + (error as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby="task-form-description">
        <DialogHeader>
          <DialogTitle>{initialData?.id ? "Edit Task" : "Create New Task"}</DialogTitle>
          <p id="task-form-description" className="text-sm text-muted-foreground">
            Fill in the details below to {initialData?.id ? "update the" : "create a new"} task.
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter task title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "medium"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "pending"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={
                              "w-full pl-3 text-left font-normal " +
                              (!field.value && "text-muted-foreground")
                            }
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0))
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="relatedId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead *</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(parseInt(value));
                        // Set relatedTo to 'lead' when a lead is selected
                        form.setValue("relatedTo", "lead");
                        console.log("Task form - selected lead ID:", value);
                      }}
                      value={field.value ? field.value.toString() : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lead" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(leads) && leads.length > 0 ? (
                          leads.map((lead: any) => (
                            <SelectItem key={lead.id} value={lead.id.toString()}>
                              {lead.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-leads" disabled>No leads available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground mt-1">
                      Tasks must be associated with a lead for proper tracking
                    </p>
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(parseInt(value));
                      }}
                      value={field.value ? field.value.toString() : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sales person" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(users) && users.length > 0 ? (
                          users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.fullName || user.username}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-users" disabled>No team members available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="contactPersonId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(parseInt(value));
                        // The mobile number will be set via the effect
                      }}
                      value={field.value ? field.value.toString() : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select contact person" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.isArray(contacts) && contacts.length > 0 ? (
                          contacts.map((contact: any) => (
                            <SelectItem key={contact.id} value={contact.id.toString()}>
                              {contact.firstName} {contact.lastName}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-contacts" disabled>No contacts available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="mobileNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Mobile number will auto-populate when contact is selected" 
                      {...field} 
                      disabled={!!selectedContactMobile}
                    />
                  </FormControl>
                  <FormMessage />
                  {selectedContactMobile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-populated from selected contact
                    </p>
                  )}
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter task description" 
                      value={field.value || ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      name={field.name}
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
                {initialData?.id ? "Update Task" : "Create Task"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default TaskForm;