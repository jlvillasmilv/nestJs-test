import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { Paginate } from 'nestjs-paginate';
import type { PaginateQuery } from 'nestjs-paginate';

@Controller('projects')
@UseGuards(AuthGuard('jwt'))
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(
    @Body() createProjectDto: CreateProjectDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.projectsService.create(createProjectDto, req.user.userId);
  }

  @Get()
  findAll(
    @Paginate() query: PaginateQuery,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.projectsService.findAll(query, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request & { user: JwtUser }) {
    return this.projectsService.findOne(+id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() req: Request & { user: JwtUser },
  ) {
    return this.projectsService.update(+id, updateProjectDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request & { user: JwtUser }) {
    return this.projectsService.remove(+id, req.user.userId);
  }
}
